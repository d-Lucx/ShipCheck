#!/usr/bin/env node
import path from 'node:path';
import {
  buildAuditBundle,
  computeOverallScore,
  computeTier,
  PILLAR_META,
  type AuditRecord,
  type PillarKey,
} from '../../core/src/index.ts';
import { collectLocalRepositoryFiles, detectLocalGitMetadata } from './fileCollector.ts';
import { probeLiveUrl } from './liveScanner.ts';

interface CliOptions {
  command: string;
  dir: string;
  url: string;
  api: string;
  publish: boolean;
  ci: boolean;
  failUnder: number | null;
  provider: 'gemini' | 'openai' | 'anthropic';
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    command: 'audit',
    dir: process.cwd(),
    url: '',
    api: process.env.SHIPCHECK_API_URL || 'http://localhost:3000',
    publish: false,
    ci: false,
    failUnder: null,
    provider: 'gemini',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === 'audit' || arg === 'scan') {
      opts.command = arg;
    } else if (arg === '--dir' && argv[i + 1]) {
      opts.dir = path.resolve(argv[++i]);
    } else if (arg === '--url' && argv[i + 1]) {
      opts.url = argv[++i];
    } else if (arg === '--api' && argv[i + 1]) {
      opts.api = argv[++i];
    } else if (arg === '--publish') {
      opts.publish = true;
    } else if (arg === '--ci') {
      opts.ci = true;
    } else if (arg === '--fail-under' && argv[i + 1]) {
      const parsed = Number(argv[++i]);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
        opts.failUnder = parsed;
      }
    } else if (arg === '--provider' && argv[i + 1]) {
      const provider = argv[++i];
      if (provider === 'gemini' || provider === 'openai' || provider === 'anthropic') {
        opts.provider = provider;
      }
    }
  }

  return opts;
}

function renderBar(score: number): string {
  const filled = Math.round(score / 5);
  const empty = Math.max(0, 20 - filled);
  const color = score >= 75 ? '\x1b[32m' : score >= 50 ? '\x1b[33m' : '\x1b[31m';
  return `${color}${'█'.repeat(filled)}\x1b[90m${'░'.repeat(empty)}\x1b[0m`;
}

function computePass1HeuristicPreview(bundle: Awaited<ReturnType<typeof buildAuditBundle>>) {
  const m = bundle.metrics;
  const func = Math.min(
    100,
    Math.max(
      15,
      62 +
        (m.resilience.hasErrorBoundary ? 10 : 0) +
        (m.resilience.hasRateLimiting ? 10 : 0) +
        (m.resilience.hasInputValidation ? 10 : 0) -
        (m.resilience.hasEnvLeak ? 35 : 0) -
        (m.largestFile.isMonolith ? 12 : 0)
    )
  );
  const antiSlop = Math.min(
    100,
    Math.max(
      10,
      96 -
        m.weightedSlopPenalty * 3 -
        Math.min(20, m.todoCount * 3) -
        Math.min(12, Math.floor(m.consoleLogCount / 3)) -
        (m.largestFile.isMonolith ? 15 : 0)
    )
  );
  const scores = {
    functionality: Math.round(func),
    usefulness: 84,
    anti_slop: Math.round(antiSlop),
    creativity: 82,
    marketability: 84,
  };
  const overall = computeOverallScore(scores);
  return { scores, overall, tier: computeTier(overall) };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const files = collectLocalRepositoryFiles(opts.dir);
  const { repoSlug, commitSha } = detectLocalGitMetadata(opts.dir);

  const liveProbe = opts.url ? await probeLiveUrl(opts.url) : null;
  const bundle = await buildAuditBundle({
    repoSlug,
    commitSha,
    liveUrl: opts.url,
    files,
    liveProbe,
  });

  let remoteAudit: AuditRecord | null = null;
  if (opts.publish) {
    try {
      const response = await fetch(`${opts.api.replace(/\/$/, '')}/api/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'bundle',
          bundle,
          provider: opts.provider,
        }),
      });
      if (response.ok) {
        remoteAudit = (await response.json()) as AuditRecord;
      }
    } catch {
      // Fallback to Pass 1 local summary if server is offline
    }
  }

  const localPreview = computePass1HeuristicPreview(bundle);
  const finalScore = remoteAudit ? remoteAudit.overallScore : localPreview.overall;
  const finalTier = remoteAudit ? remoteAudit.tier : localPreview.tier;
  const finalPillars = remoteAudit ? remoteAudit.pillarScores : localPreview.scores;

  if (opts.ci) {
    process.stdout.write(
      `${JSON.stringify(
        {
          repoSlug: bundle.repoSlug,
          commitSha: bundle.commitSha,
          bundleHash: bundle.bundleHash,
          overallScore: finalScore,
          tier: finalTier,
          pillarScores: finalPillars,
          metrics: bundle.metrics,
          receiptUrl: remoteAudit ? `${opts.api.replace(/\/$/, '')}/r/${remoteAudit.id}` : null,
        },
        null,
        2
      )}\n`
    );
  } else {
    const lines: string[] = [
      '',
      '\x1b[1mShipCheck Benchmark Report\x1b[0m',
      `Repository : ${bundle.repoSlug} @ ${bundle.commitSha.slice(0, 7)}`,
      `Bundle SHA : ${bundle.bundleHash.slice(0, 16)}...`,
      `Score      : \x1b[1m${finalScore}/100\x1b[0m (${finalTier})`,
      '',
    ];

    const keys: PillarKey[] = [
      'functionality',
      'usefulness',
      'anti_slop',
      'creativity',
      'marketability',
    ];
    for (const key of keys) {
      const label = PILLAR_META[key].shortLabel.padEnd(15);
      const val = String(finalPillars[key]).padStart(3);
      lines.push(`  ${label} ${renderBar(finalPillars[key])}  ${val}/100 (${PILLAR_META[key].weightPct}%)`);
    }

    lines.push('');
    lines.push(
      `Pass 1 Metrics: ${bundle.metrics.totalFiles} files · ${bundle.metrics.totalLoc} LOC · Largest: ${bundle.metrics.largestFile.path} (${bundle.metrics.largestFile.loc} LOC)`
    );
    lines.push(
      `Hygiene       : ${bundle.metrics.totalSlopHits} slop hits · ${bundle.metrics.todoCount} unfinished markers · ${bundle.metrics.consoleLogCount} console.logs`
    );
    lines.push(
      `Resilience    : ErrorBoundary=${bundle.metrics.resilience.hasErrorBoundary} · Validation=${bundle.metrics.resilience.hasInputValidation} · RateLimit=${bundle.metrics.resilience.hasRateLimiting} · EnvLeak=${bundle.metrics.resilience.hasEnvLeak}`
    );

    if (bundle.metrics.slopHits.length > 0) {
      lines.push('');
      lines.push('\x1b[31mSlop Lexicon Flags:\x1b[0m');
      for (const hit of bundle.metrics.slopHits.slice(0, 8)) {
        lines.push(`  - ${hit.filePath}: "${hit.phrase}" (x${hit.count}, weight ${hit.weight})`);
      }
    }

    if (remoteAudit) {
      lines.push('');
      lines.push(`Verdict    : ${remoteAudit.roastVerdict}`);
      lines.push(`Receipt    : ${opts.api.replace(/\/$/, '')}/r/${remoteAudit.id}`);
    }
    lines.push('');
    process.stdout.write(`${lines.join('\n')}\n`);
  }

  if (opts.failUnder !== null && finalScore < opts.failUnder) {
    process.stderr.write(
      `ShipCheck threshold failed: score ${finalScore} is below --fail-under ${opts.failUnder}\n`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`ShipCheck CLI error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
