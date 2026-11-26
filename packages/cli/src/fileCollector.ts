import fs from 'node:fs';
import path from 'node:path';
import type { SourceFileEntry } from '../../core/src/schema.ts';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  'coverage',
  '.aistudio',
  'drizzle',
]);

const IGNORED_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  '.DS_Store',
]);

const ALLOWED_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|css|html|md|mdx|json|yaml|yml)$/i;
const MAX_FILE_BYTES = 250_000;
const MAX_FILES = 300;

export function collectLocalRepositoryFiles(rootDir: string): SourceFileEntry[] {
  const resolvedRoot = path.resolve(rootDir);
  const collected: SourceFileEntry[] = [];

  function walk(currentDir: string): void {
    if (collected.length >= MAX_FILES) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (collected.length >= MAX_FILES) break;
      if (entry.name.startsWith('.env')) continue;

      const fullPath = path.resolve(currentDir, entry.name);
      if (!fullPath.startsWith(resolvedRoot + path.sep)) continue;

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        if (IGNORED_FILES.has(entry.name)) continue;
        if (!ALLOWED_EXT.test(entry.name)) continue;
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > MAX_FILE_BYTES) continue;
          const content = fs.readFileSync(fullPath, 'utf8');
          const relativePath = path.relative(resolvedRoot, fullPath).split(path.sep).join('/');
          collected.push({ path: relativePath, content });
        } catch {
          // Skip unreadable files safely
        }
      }
    }
  }

  walk(resolvedRoot);
  return collected;
}

export function detectLocalGitMetadata(rootDir: string): {
  repoSlug: string;
  commitSha: string;
} {
  const resolvedRoot = path.resolve(rootDir);
  let commitSha = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
  let repoSlug = 'shipcheck/workspace';

  try {
    const headPath = path.resolve(resolvedRoot, '.git', 'HEAD');
    if (headPath.startsWith(resolvedRoot + path.sep) && fs.existsSync(headPath)) {
      const head = fs.readFileSync(headPath, 'utf8').trim();
      if (head.startsWith('ref: ')) {
        const refRel = head.slice(5).trim();
        const refPath = path.resolve(resolvedRoot, '.git', refRel);
        if (refPath.startsWith(resolvedRoot + path.sep) && fs.existsSync(refPath)) {
          const sha = fs.readFileSync(refPath, 'utf8').trim();
          if (/^[a-fA-F0-9]{7,40}$/.test(sha)) {
            commitSha = sha;
          }
        }
      } else if (/^[a-fA-F0-9]{7,40}$/.test(head)) {
        commitSha = head;
      }
    }

    const configPath = path.resolve(resolvedRoot, '.git', 'config');
    if (configPath.startsWith(resolvedRoot + path.sep) && fs.existsSync(configPath)) {
      const gitConfig = fs.readFileSync(configPath, 'utf8');
      const match = gitConfig.match(/github\.com[:/]([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+?)(?:\.git)?\s/);
      if (match?.[1]) {
        repoSlug = match[1];
      }
    }
  } catch {
    // Fallback to package.json metadata below
  }

  if (repoSlug === 'shipcheck/workspace') {
    try {
      const pkgPath = path.resolve(resolvedRoot, 'package.json');
      if (pkgPath.startsWith(resolvedRoot + path.sep) && fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string };
        if (pkg.name && pkg.name !== 'react-example') {
          const clean = pkg.name.replace(/^@/, '').replace(/[^a-zA-Z0-9_.-/]/g, '-');
          repoSlug = clean.includes('/') ? clean : `local/${clean}`;
        } else {
          repoSlug = 'shipcheck/shipcheck';
        }
      }
    } catch {
      repoSlug = 'shipcheck/shipcheck';
    }
  }

  return { repoSlug, commitSha };
}
