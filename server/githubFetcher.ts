import type { SourceFileEntry } from '../packages/core/src/schema.ts';

const REPO_SLUG_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const ALLOWED_CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|css|html|md|mdx|json|yaml|yml)$/i;

interface GitHubRepoResponse {
  default_branch?: string;
  full_name?: string;
}

interface GitHubTreeItem {
  path?: string;
  type?: string;
  size?: number;
}

interface GitHubTreeResponse {
  sha?: string;
  tree?: GitHubTreeItem[];
}

function rankGitHubPath(p: string): number {
  const lower = p.toLowerCase();
  if (lower.includes('node_modules/') || lower.includes('dist/') || lower.includes('lock')) return -100;
  let score = 10;
  if (lower === 'package.json' || lower === 'readme.md' || lower === 'requirements.txt') score += 95;
  if (lower.includes('server.') || lower.includes('/api/') || lower.includes('route.ts')) score += 75;
  if (lower.endsWith('app.tsx') || lower.endsWith('page.tsx') || lower.endsWith('main.tsx')) score += 70;
  if (lower.startsWith('src/') || lower.startsWith('app/') || lower.startsWith('packages/')) score += 40;
  return score;
}

export async function fetchPublicGitHubRepo(repoSlug: string): Promise<{
  repoSlug: string;
  commitSha: string;
  files: SourceFileEntry[];
}> {
  const cleaned = repoSlug.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/$/, '');
  if (!REPO_SLUG_REGEX.test(cleaned)) {
    throw new Error('Repository slug must be in "owner/repo" format.');
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ShipCheck-Scanner/1.0',
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const repoRes = await fetch(`https://api.github.com/repos/${cleaned}`, {
      headers,
      signal: controller.signal,
    });
    if (repoRes.status === 404) {
      throw new Error(`Public GitHub repository "${cleaned}" was not found.`);
    }
    if (repoRes.status === 403) {
      throw new Error('GitHub API rate limit reached. Try pasting files or running the ShipCheck CLI locally.');
    }
    if (!repoRes.ok) {
      throw new Error(`GitHub API error (${repoRes.status}) while loading "${cleaned}".`);
    }

    const repoData = (await repoRes.json()) as GitHubRepoResponse;
    const branch = repoData.default_branch || 'main';
    const canonicalSlug = repoData.full_name || cleaned;

    const commitRes = await fetch(
      `https://api.github.com/repos/${canonicalSlug}/commits/${encodeURIComponent(branch)}`,
      { headers, signal: controller.signal }
    );
    let commitSha = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
    if (commitRes.ok) {
      const commitJson = (await commitRes.json()) as { sha?: string };
      if (commitJson.sha && /^[a-fA-F0-9]{7,40}$/.test(commitJson.sha)) {
        commitSha = commitJson.sha;
      }
    }

    const treeRes = await fetch(
      `https://api.github.com/repos/${canonicalSlug}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers, signal: controller.signal }
    );
    if (!treeRes.ok) {
      throw new Error(`Could not list repository tree for "${canonicalSlug}".`);
    }

    const treeJson = (await treeRes.json()) as GitHubTreeResponse;
    const blobs = (treeJson.tree ?? [])
      .filter(
        (item): item is { path: string; type: string; size?: number } =>
          item.type === 'blob' &&
          typeof item.path === 'string' &&
          ALLOWED_CODE_EXT.test(item.path) &&
          !item.path.includes('.env') &&
          !item.path.endsWith('package-lock.json') &&
          (item.size ?? 0) <= 180_000
      )
      .sort((a, b) => rankGitHubPath(b.path) - rankGitHubPath(a.path))
      .slice(0, 16);

    if (blobs.length === 0) {
      throw new Error(`No scannable source files found in "${canonicalSlug}".`);
    }

    const fetched = await Promise.all(
      blobs.map(async (item): Promise<SourceFileEntry | null> => {
        try {
          const encodedPath = item.path
            .split('/')
            .map((segment) => encodeURIComponent(segment))
            .join('/');
          const rawRes = await fetch(
            `https://raw.githubusercontent.com/${canonicalSlug}/${encodeURIComponent(branch)}/${encodedPath}`,
            { headers: { 'User-Agent': 'ShipCheck-Scanner/1.0' }, signal: controller.signal }
          );
          if (!rawRes.ok) return null;
          const content = await rawRes.text();
          return { path: item.path, content };
        } catch {
          return null;
        }
      })
    );

    const files = fetched.filter((entry): entry is SourceFileEntry => entry !== null);
    if (files.length === 0) {
      throw new Error(`Failed to fetch source file contents from "${canonicalSlug}".`);
    }

    return { repoSlug: canonicalSlug, commitSha, files };
  } finally {
    clearTimeout(timeout);
  }
}
