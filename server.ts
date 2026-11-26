import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import {
  AuditBundleSchema,
  buildAuditBundle,
  SourceFileEntrySchema,
  type AuditRecord,
} from './packages/core/src/index.ts';
import {
  collectLocalRepositoryFiles,
  detectLocalGitMetadata,
} from './packages/cli/src/fileCollector.ts';
import { probeLiveUrl } from './packages/cli/src/liveScanner.ts';
import { fetchPublicGitHubRepo } from './server/githubFetcher.ts';
import { runCalibratedJudge, type ScreenshotInput } from './server/judge.ts';
import {
  cacheRuntimeAudit,
  fetchLatestPublicAuditForRepo,
  fetchPublicAuditById,
} from './server/firestorePublicReader.ts';
import { renderBadgeSvg, renderOgReceiptSvg } from './server/svgRenderers.ts';

dotenv.config();

const PORT = 3000;
const WORKSPACE_ROOT = path.resolve(process.cwd());

// Sliding-window in-memory rate limiter for audit endpoints
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

function auditRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const timestamps = (rateLimitStore.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      error: 'Rate limit exceeded. Please wait a minute before running another audit.',
    });
    return;
  }
  timestamps.push(now);
  rateLimitStore.set(ip, timestamps);
  next();
}

const ScreenshotSchema = z.object({
  label: z.enum(['desktop', 'mobile']),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  base64Data: z.string().min(16).max(3_500_000),
});

const AuditRequestSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('github'),
    repoSlug: z
      .string()
      .min(3)
      .max(200),
    liveUrl: z.string().max(512).optional().default(''),
    screenshots: z.array(ScreenshotSchema).max(2).optional().default([]),
  }),
  z.object({
    mode: z.literal('files'),
    repoSlug: z
      .string()
      .min(3)
      .max(140)
      .regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, 'Repo slug must match owner/repo'),
    commitSha: z
      .string()
      .regex(/^[a-fA-F0-9]{7,40}$/)
      .optional(),
    liveUrl: z.string().max(512).optional().default(''),
    files: z.array(SourceFileEntrySchema).min(1).max(40),
    screenshots: z.array(ScreenshotSchema).max(2).optional().default([]),
  }),
  z.object({
    mode: z.literal('bundle'),
    bundle: AuditBundleSchema,
    screenshots: z.array(ScreenshotSchema).max(2).optional().default([]),
  }),
]);

function generateAuditId(repoSlug: string): string {
  const prefix = repoSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  const suffix = crypto.randomBytes(5).toString('hex');
  return `${prefix || 'audit'}-${suffix}`;
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '8mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'shipcheck', timestamp: new Date().toISOString() });
  });

  // Two-pass Audit Engine endpoint (GitHub repo, uploaded/pasted files, or CLI AuditBundle)
  app.post('/api/audit', auditRateLimiter, async (req, res) => {
    const parsed = AuditRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid audit request payload.',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
      return;
    }

    try {
      const input = parsed.data;
      let bundle;
      const screenshots: ScreenshotInput[] = input.screenshots ?? [];

      if (input.mode === 'bundle') {
        bundle = input.bundle;
      } else if (input.mode === 'github') {
        const gh = await fetchPublicGitHubRepo(input.repoSlug);
        const liveProbe = input.liveUrl.trim() ? await probeLiveUrl(input.liveUrl.trim()) : null;
        bundle = await buildAuditBundle({
          repoSlug: gh.repoSlug,
          commitSha: gh.commitSha,
          liveUrl: input.liveUrl.trim(),
          files: gh.files,
          liveProbe,
        });
      } else {
        const liveProbe = input.liveUrl.trim() ? await probeLiveUrl(input.liveUrl.trim()) : null;
        const commitSha =
          input.commitSha || crypto.createHash('sha1').update(JSON.stringify(input.files)).digest('hex');
        bundle = await buildAuditBundle({
          repoSlug: input.repoSlug,
          commitSha,
          liveUrl: input.liveUrl.trim(),
          files: input.files,
          liveProbe,
        });
      }

      const evaluation = await runCalibratedJudge(bundle, screenshots);
      const record: AuditRecord = {
        id: generateAuditId(bundle.repoSlug),
        repoSlug: bundle.repoSlug,
        commitSha: bundle.commitSha,
        liveUrl: bundle.liveUrl || '',
        bundleHash: bundle.bundleHash,
        overallScore: evaluation.overallScore,
        tier: evaluation.tier,
        roastVerdict: evaluation.roastVerdict,
        pillarScores: evaluation.pillarScores,
        fullReport: evaluation.fullReport,
        slopHitCount: bundle.metrics.totalSlopHits,
        isPublic: true,
        createdAt: new Date().toISOString(),
      };

      cacheRuntimeAudit(record);
      res.json(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Audit evaluation failed.';
      console.error('Audit endpoint error:', error);
      res.status(500).json({ error: message });
    }
  });

  // Self-Audit endpoint: scans this ShipCheck workspace through Pass 1 + Pass 2
  app.post('/api/audit/workspace', auditRateLimiter, async (_req, res) => {
    try {
      const files = collectLocalRepositoryFiles(WORKSPACE_ROOT);
      const { repoSlug, commitSha } = detectLocalGitMetadata(WORKSPACE_ROOT);
      const bundle = await buildAuditBundle({
        repoSlug: repoSlug === 'local/react-example' ? 'shipcheck/shipcheck' : repoSlug,
        commitSha,
        liveUrl: process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL' ? process.env.APP_URL : '',
        files,
        liveProbe: null,
      });

      const evaluation = await runCalibratedJudge(bundle);
      const record: AuditRecord = {
        id: generateAuditId(bundle.repoSlug),
        repoSlug: bundle.repoSlug,
        commitSha: bundle.commitSha,
        liveUrl: bundle.liveUrl || '',
        bundleHash: bundle.bundleHash,
        overallScore: evaluation.overallScore,
        tier: evaluation.tier,
        roastVerdict: evaluation.roastVerdict,
        pillarScores: evaluation.pillarScores,
        fullReport: evaluation.fullReport,
        slopHitCount: bundle.metrics.totalSlopHits,
        isPublic: true,
        createdAt: new Date().toISOString(),
      };

      cacheRuntimeAudit(record);
      res.json(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Workspace self-audit failed.';
      console.error('Workspace self-audit error:', error);
      res.status(500).json({ error: message });
    }
  });

  // Dynamic SVG README Badge: GET /api/badge/:owner/:repo
  app.get('/api/badge/:owner/:repo', async (req, res) => {
    const owner = String(req.params.owner || '');
    const repo = String(req.params.repo || '');
    const rawStyle = typeof req.query.style === 'string' ? req.query.style : 'flat';
    const style =
      rawStyle === 'flat-square' || rawStyle === 'for-the-badge' ? rawStyle : 'flat';
    const showTier = req.query.showTier !== 'false';
    const label = typeof req.query.label === 'string' ? req.query.label.slice(0, 24) : 'ShipCheck';
    const auditIdParam = typeof req.query.auditId === 'string' ? req.query.auditId : '';

    const audit =
      (auditIdParam ? await fetchPublicAuditById(auditIdParam) : null) ??
      (await fetchLatestPublicAuditForRepo(owner, repo));

    const svg = audit
      ? renderBadgeSvg({
          score: audit.overallScore,
          tier: audit.tier,
          style,
          label,
          showTier,
        })
      : renderBadgeSvg({
          score: null,
          tier: 'Unaudited',
          style,
          label,
          showTier,
        });

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);
  });

  // Dynamic OpenGraph Receipt Card: GET /api/og/:auditId
  app.get('/api/og/:auditId', async (req, res) => {
    const auditId = String(req.params.auditId || '');
    const audit = await fetchPublicAuditById(auditId);

    if (!audit) {
      res.status(404).json({ error: 'Public audit receipt not found.' });
      return;
    }

    const svg = renderOgReceiptSvg(audit);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);
  });

  // Public receipt JSON lookup for direct /r/:auditId hydration
  app.get('/api/receipts/:auditId', async (req, res) => {
    const auditId = String(req.params.auditId || '');
    const audit = await fetchPublicAuditById(auditId);
    if (!audit) {
      res.status(404).json({ error: 'Audit receipt not found.' });
      return;
    }
    res.json(audit);
  });

  // Serve Vite dev middleware or production static assets
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(WORKSPACE_ROOT, 'dist');

  if (!isProd || !fs.existsSync(distDir)) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    process.stdout.write(`ShipCheck server listening on http://0.0.0.0:${PORT}\n`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ShipCheck server:', err);
  process.exit(1);
});
