import { z } from 'zod';

export const TierSchema = z.enum([
  'Apex Craft',
  'Ship-Ready',
  'Weekend Hackathon',
  'Certified AI Slop',
  'Vaporware',
]);

export type Tier = z.infer<typeof TierSchema>;

export const PillarKeySchema = z.enum([
  'functionality',
  'usefulness',
  'anti_slop',
  'creativity',
  'marketability',
]);

export type PillarKey = z.infer<typeof PillarKeySchema>;

export const PillarScoresSchema = z.object({
  functionality: z.number().int().min(0).max(100),
  usefulness: z.number().int().min(0).max(100),
  anti_slop: z.number().int().min(0).max(100),
  creativity: z.number().int().min(0).max(100),
  marketability: z.number().int().min(0).max(100),
});

export type PillarScores = z.infer<typeof PillarScoresSchema>;

export const SlopHitSchema = z.object({
  filePath: z.string(),
  phrase: z.string(),
  count: z.number().int().min(1),
  weight: z.number().min(1).max(10),
});

export type SlopHit = z.infer<typeof SlopHitSchema>;

export const LiveProbeMetricsSchema = z.object({
  url: z.string(),
  httpStatus: z.number().int().min(0).max(599),
  ttfbMs: z.number().min(0),
  title: z.string(),
  metaDescription: z.string(),
  h1Text: z.string(),
  ctaText: z.array(z.string()).max(10),
  consoleErrors: z.array(z.string()).max(20),
  failedRequests: z.number().int().min(0),
  hasViewportMeta: z.boolean(),
});

export type LiveProbeMetrics = z.infer<typeof LiveProbeMetricsSchema>;

export const DeterministicMetricsSchema = z.object({
  totalFiles: z.number().int().min(0),
  totalLoc: z.number().int().min(0),
  largestFile: z.object({
    path: z.string(),
    loc: z.number().int().min(0),
    isMonolith: z.boolean(),
  }),
  todoCount: z.number().int().min(0),
  consoleLogCount: z.number().int().min(0),
  resilience: z.object({
    hasEnvLeak: z.boolean(),
    hasRateLimiting: z.boolean(),
    hasErrorBoundary: z.boolean(),
    hasInputValidation: z.boolean(),
  }),
  wrapperRatio: z.object({
    llmCallFiles: z.number().int().min(0),
    businessLogicFiles: z.number().int().min(0),
    ratio: z.number().min(0),
  }),
  slopHits: z.array(SlopHitSchema),
  totalSlopHits: z.number().int().min(0),
  weightedSlopPenalty: z.number().min(0),
  liveProbe: LiveProbeMetricsSchema.nullable().optional(),
});

export type DeterministicMetrics = z.infer<typeof DeterministicMetricsSchema>;

export const SourceFileEntrySchema = z.object({
  path: z.string().min(1).max(300),
  content: z.string(),
});

export type SourceFileEntry = z.infer<typeof SourceFileEntrySchema>;

export const AuditBundleSchema = z.object({
  repoSlug: z
    .string()
    .min(3)
    .max(140)
    .regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, 'Repo slug must match owner/repo format'),
  commitSha: z
    .string()
    .min(7)
    .max(40)
    .regex(/^[a-fA-F0-9]{7,40}$/, 'Commit SHA must be a 7-40 character hex string'),
  liveUrl: z.string().max(512).optional().default(''),
  metrics: DeterministicMetricsSchema,
  selectedFiles: z
    .array(
      z.object({
        path: z.string(),
        loc: z.number().int().min(0),
        excerpt: z.string(),
      })
    )
    .max(12),
  bundleHash: z.string().length(64).regex(/^[a-f0-9]{64}$/),
});

export type AuditBundle = z.infer<typeof AuditBundleSchema>;

export const PillarEvidenceSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string().min(5).max(360),
  strengths: z.array(z.string().min(4).max(260)).min(1).max(4),
  deductions: z.array(z.string().min(4).max(260)).max(4),
});

export type PillarEvidence = z.infer<typeof PillarEvidenceSchema>;

export const JudgeOutputSchema = z.object({
  pillars: z.object({
    functionality: PillarEvidenceSchema,
    usefulness: PillarEvidenceSchema,
    anti_slop: PillarEvidenceSchema,
    creativity: PillarEvidenceSchema,
    marketability: PillarEvidenceSchema,
  }),
  roastVerdict: z.string().min(10).max(280),
  topFixes: z.array(z.string().min(5).max(240)).min(1).max(3),
});

export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;

export const AuditReportSchema = z.object({
  pass1: DeterministicMetricsSchema,
  pass2: JudgeOutputSchema,
  fileManifest: z.array(z.object({ path: z.string(), loc: z.number().int() })).max(12),
  evaluatedAt: z.string(),
  judgeModel: z.string(),
});

export type AuditReport = z.infer<typeof AuditReportSchema>;

export const AuditRecordSchema = z.object({
  id: z.string().min(4).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  authorUid: z.string().min(1).max(128).optional(),
  repoSlug: z.string().min(3).max(140),
  commitSha: z.string().min(7).max(40),
  liveUrl: z.string().max(512).default(''),
  bundleHash: z.string().length(64),
  overallScore: z.number().int().min(0).max(100),
  tier: TierSchema,
  roastVerdict: z.string().min(10).max(280),
  pillarScores: PillarScoresSchema,
  fullReport: AuditReportSchema,
  slopHitCount: z.number().int().min(0).max(10000),
  isPublic: z.boolean().default(true),
  createdAt: z.string(),
  isReference: z.boolean().optional(),
});

export type AuditRecord = z.infer<typeof AuditRecordSchema>;
