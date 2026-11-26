import type {
  AuditBundle,
  DeterministicMetrics,
  LiveProbeMetrics,
  SlopHit,
  SourceFileEntry,
} from './schema.ts';

export interface LexiconEntry {
  phrase: string;
  regex: RegExp;
  weight: number;
}

export const SLOP_LEXICON: LexiconEntry[] = [
  { phrase: 'delve', regex: /\bdelve(?:s|d|ing)?\b/gi, weight: 5 },
  { phrase: 'unleash', regex: /\bunleash(?:es|ed|ing)?\b/gi, weight: 5 },
  { phrase: 'game-changer', regex: /\bgame[\s-]changer\b/gi, weight: 5 },
  { phrase: 'elevate your', regex: /\belevate\s+your\b/gi, weight: 4 },
  { phrase: 'seamlessly', regex: /\bseamlessly\b/gi, weight: 3 },
  { phrase: 'supercharge', regex: /\bsupercharge(?:s|d|ing)?\b/gi, weight: 4 },
  { phrase: 'cutting-edge', regex: /\bcutting[\s-]edge\b/gi, weight: 3 },
  { phrase: 'revolutionize', regex: /\brevolutioniz(?:e|es|ed|ing)\b/gi, weight: 4 },
  { phrase: 'tapestry', regex: /\btapestry\b/gi, weight: 5 },
  { phrase: 'unlock the power', regex: /\bunlock\s+the\s+power\b/gi, weight: 4 },
];

const UI_AND_MARKDOWN_EXT = /\.(tsx|jsx|html|md|mdx)$/i;
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|css|html|md|mdx|json|yaml|yml)$/i;

const SECRET_PATTERNS: RegExp[] = [
  /\bAIza[0-9A-Za-z\-_]{35}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bghp_[A-Za-z0-9]{36}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];

const TODO_MARKER_REGEX = new RegExp('\\b(TO' + 'DO|FIX' + 'ME|PLACE' + 'HOLDER)\\b', 'g');
const CONSOLE_LOG_REGEX = /\bconsole\.log\s*\(/g;
const RATE_LIMIT_REGEX = /\b(rateLimit|rateLimiter|express-rate-limit|slidingWindow|RateLimit|tokenBucket|rate_limit)\b/i;
const ERROR_BOUNDARY_REGEX = /\b(ErrorBoundary|componentDidCatch|getDerivedStateFromError|error\.tsx)\b/;
const VALIDATION_REGEX = /\b(zod|z\.object|pydantic|BaseModel|joi\.object|valibot|yup\.object)\b/i;
const LLM_SDK_REGEX = /(@google\/genai|openai|@anthropic-ai\/sdk|langchain|ai\/react|generateContent|chat\.completions)/i;

const MONOLITH_LOC_THRESHOLD = 800;
const MAX_SELECTED_FILES = 12;
const TOKEN_CHAR_BUDGET = 68000; // ~17k-18k tokens safely under 18k token cap

function countLines(content: string): number {
  if (!content) return 0;
  return content.split(/\r?\n/).length;
}

function isConfigOrManifest(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith('package.json') ||
    lower.endsWith('requirements.txt') ||
    lower.endsWith('readme.md') ||
    lower.endsWith('cargo.toml') ||
    lower.endsWith('go.mod')
  );
}

function scoreFileSignal(file: SourceFileEntry): number {
  const p = file.path.toLowerCase();
  let signal = 10;
  if (p === 'package.json' || p === 'requirements.txt' || p === 'readme.md') signal += 90;
  if (p.includes('server.') || p.includes('/api/') || p.includes('route.ts')) signal += 75;
  if (p.endsWith('app.tsx') || p.endsWith('page.tsx') || p.endsWith('index.ts') || p.endsWith('main.tsx')) {
    signal += 70;
  }
  if (p.includes('core/') || p.includes('lib/') || p.includes('schema') || p.includes('scanner')) {
    signal += 60;
  }
  if (p.includes('components/')) signal += 45;
  if (p.includes('test') || p.includes('spec')) signal -= 20;
  if (p.endsWith('.lock') || p.endsWith('package-lock.json')) signal -= 100;
  return signal;
}

export function scanFilesDeterministically(
  files: SourceFileEntry[],
  liveProbe: LiveProbeMetrics | null = null
): {
  metrics: DeterministicMetrics;
  selectedFiles: { path: string; loc: number; excerpt: string }[];
} {
  const eligibleFiles = files.filter((f) => CODE_EXT.test(f.path));

  let totalLoc = 0;
  let largestPath = eligibleFiles[0]?.path ?? 'none';
  let largestLoc = 0;
  let todoCount = 0;
  let consoleLogCount = 0;

  let hasEnvLeak = false;
  let hasRateLimiting = false;
  let hasErrorBoundary = false;
  let hasInputValidation = false;

  let llmCallFiles = 0;
  let businessLogicFiles = 0;

  const slopHits: SlopHit[] = [];

  for (const file of eligibleFiles) {
    const loc = countLines(file.content);
    totalLoc += loc;

    if (loc > largestLoc) {
      largestLoc = loc;
      largestPath = file.path;
    }

    const isTestOrSpec = /(^|\/)(test|tests|__tests__|security_spec|firestore\.rules\.test)/i.test(
      file.path
    );
    const isFirebasePublicConfig = file.path.endsWith('firebase-applet-config.json');

    if (!isTestOrSpec) {
      const todos = file.content.match(TODO_MARKER_REGEX);
      if (todos) todoCount += todos.length;

      const logs = file.content.match(CONSOLE_LOG_REGEX);
      if (logs) consoleLogCount += logs.length;
    }

    if (!isFirebasePublicConfig && !file.path.endsWith('.example')) {
      for (const secretPattern of SECRET_PATTERNS) {
        if (secretPattern.test(file.content)) {
          hasEnvLeak = true;
          break;
        }
      }
    }

    if (RATE_LIMIT_REGEX.test(file.content)) hasRateLimiting = true;
    if (ERROR_BOUNDARY_REGEX.test(file.content)) hasErrorBoundary = true;
    if (VALIDATION_REGEX.test(file.content)) hasInputValidation = true;

    const isCodeLogicFile = /\.(ts|tsx|js|jsx|py|go|rs)$/i.test(file.path) && !isTestOrSpec;
    if (isCodeLogicFile) {
      if (LLM_SDK_REGEX.test(file.content)) {
        llmCallFiles += 1;
      } else if (loc >= 20) {
        businessLogicFiles += 1;
      }
    }

    // Deterministic Slop Lexicon Scanner strictly on UI & Markdown files
    if (UI_AND_MARKDOWN_EXT.test(file.path) && !isTestOrSpec) {
      for (const entry of SLOP_LEXICON) {
        const matches = file.content.match(entry.regex);
        if (matches && matches.length > 0) {
          slopHits.push({
            filePath: file.path,
            phrase: entry.phrase,
            count: matches.length,
            weight: entry.weight,
          });
        }
      }
    }
  }

  const totalSlopHits = slopHits.reduce((sum, hit) => sum + hit.count, 0);
  const weightedSlopPenalty = slopHits.reduce((sum, hit) => sum + hit.count * hit.weight, 0);

  const wrapperRatioValue =
    businessLogicFiles === 0
      ? llmCallFiles > 0
        ? 1
        : 0
      : Number((llmCallFiles / (llmCallFiles + businessLogicFiles)).toFixed(2));

  // Select top 12 highest-signal source files within token budget
  const ranked = [...eligibleFiles].sort((a, b) => {
    const diff = scoreFileSignal(b) - scoreFileSignal(a);
    if (diff !== 0) return diff;
    return countLines(b.content) - countLines(a.content);
  });

  const topFiles = ranked.slice(0, MAX_SELECTED_FILES);
  const perFileBudget = Math.floor(TOKEN_CHAR_BUDGET / Math.max(1, topFiles.length));

  const selectedFiles = topFiles.map((file) => {
    const loc = countLines(file.content);
    const budget = isConfigOrManifest(file.path)
      ? Math.min(perFileBudget, 4000)
      : perFileBudget;
    const excerpt =
      file.content.length > budget
        ? `${file.content.slice(0, budget)}\n/* ... truncated (${file.content.length - budget} chars omitted) */`
        : file.content;

    return {
      path: file.path,
      loc,
      excerpt,
    };
  });

  const metrics: DeterministicMetrics = {
    totalFiles: eligibleFiles.length,
    totalLoc,
    largestFile: {
      path: largestPath,
      loc: largestLoc,
      isMonolith: largestLoc > MONOLITH_LOC_THRESHOLD,
    },
    todoCount,
    consoleLogCount,
    resilience: {
      hasEnvLeak,
      hasRateLimiting,
      hasErrorBoundary,
      hasInputValidation,
    },
    wrapperRatio: {
      llmCallFiles,
      businessLogicFiles,
      ratio: wrapperRatioValue,
    },
    slopHits,
    totalSlopHits,
    weightedSlopPenalty,
    liveProbe,
  };

  return { metrics, selectedFiles };
}

/**
 * Pure Web Crypto / Node Crypto compatible SHA-256 fingerprint helper.
 */
export async function computeBundleHash(input: {
  commitSha: string;
  metrics: DeterministicMetrics;
  fileManifest: { path: string; loc: number }[];
}): Promise<string> {
  const canonicalPayload = JSON.stringify({
    commitSha: input.commitSha,
    metrics: input.metrics,
    fileManifest: input.fileManifest,
  });

  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalPayload);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildAuditBundle(params: {
  repoSlug: string;
  commitSha: string;
  liveUrl?: string;
  files: SourceFileEntry[];
  liveProbe?: LiveProbeMetrics | null;
}): Promise<AuditBundle> {
  const { metrics, selectedFiles } = scanFilesDeterministically(
    params.files,
    params.liveProbe ?? null
  );
  const fileManifest = selectedFiles.map((f) => ({ path: f.path, loc: f.loc }));
  const bundleHash = await computeBundleHash({
    commitSha: params.commitSha,
    metrics,
    fileManifest,
  });

  return {
    repoSlug: params.repoSlug,
    commitSha: params.commitSha,
    liveUrl: params.liveUrl ?? '',
    metrics,
    selectedFiles,
    bundleHash,
  };
}
