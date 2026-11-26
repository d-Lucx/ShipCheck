import {
  computeOverallScore,
  computeTier,
  type AuditRecord,
  type PillarScores,
} from '../../packages/core/src/index.ts';

function createReferenceAudit(
  data: Omit<AuditRecord, 'overallScore' | 'tier' | 'isReference'> & {
    pillarScores: PillarScores;
  }
): AuditRecord {
  const overallScore = computeOverallScore(data.pillarScores);
  const tier = computeTier(overallScore);
  return {
    ...data,
    overallScore,
    tier,
    isReference: true,
  };
}

export const REFERENCE_AUDITS: AuditRecord[] = [
  createReferenceAudit({
    id: 'ref-linear-sync-engine',
    repoSlug: 'linear-craft/local-sync-kit',
    commitSha: '9f4e2c1a8b7d6e5f4c3b2a1908f7e6d5c4b3a210',
    liveUrl: 'https://local-sync-kit.example.dev',
    bundleHash: '8e4a91f3b20c64d8e5f1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3',
    roastVerdict:
      'Disciplined IndexedDB conflict resolution and strict schema guards shine, though onboarding docs assume prior CRDT fluency.',
    pillarScores: {
      functionality: 94,
      usefulness: 92,
      anti_slop: 97,
      creativity: 90,
      marketability: 84,
    },
    slopHitCount: 0,
    isPublic: true,
    createdAt: '2026-11-24T16:40:00.000Z',
    fullReport: {
      pass1: {
        totalFiles: 38,
        totalLoc: 4820,
        largestFile: { path: 'src/engine/deltaReconciler.ts', loc: 312, isMonolith: false },
        todoCount: 0,
        consoleLogCount: 0,
        resilience: {
          hasEnvLeak: false,
          hasRateLimiting: true,
          hasErrorBoundary: true,
          hasInputValidation: true,
        },
        wrapperRatio: { llmCallFiles: 0, businessLogicFiles: 29, ratio: 0 },
        slopHits: [],
        totalSlopHits: 0,
        weightedSlopPenalty: 0,
        liveProbe: {
          url: 'https://local-sync-kit.example.dev',
          httpStatus: 200,
          ttfbMs: 88,
          title: 'LocalSyncKit — Deterministic Offline Sync Engine',
          metaDescription: 'Sub-millisecond local state sync with typed schema migrations.',
          h1Text: 'Offline-first sync without server lock-in',
          ctaText: ['Inspect Architecture', 'Run Benchmark', 'Read Docs'],
          consoleErrors: [],
          failedRequests: 0,
          hasViewportMeta: true,
        },
      },
      pass2: {
        pillars: {
          functionality: {
            score: 94,
            summary: 'Modular delta engine with strict Zod payload validation and zero runtime console errors.',
            strengths: [
              'src/engine/deltaReconciler.ts isolates conflict merges in 312 well-typed lines.',
              'Live URL probe returned HTTP 200 in 88ms with zero console errors.',
              'ErrorBoundary, rate limiting, and Zod validation verified in Pass 1 metrics.',
            ],
            deductions: [
              'src/worker/storageWorker.ts lacks explicit quota-exceeded recovery telemetry.',
            ],
          },
          usefulness: {
            score: 92,
            summary: 'Eliminates recurring optimistic-UI race conditions for collaborative web teams.',
            strengths: [
              'README.md demonstrates working 15-line drop-in store binding.',
              'Direct painkiller for multi-tab offline state corruption.',
            ],
            deductions: [
              'Migration guide in docs/migrations.md expects manual SQLite schema diffs.',
            ],
          },
          anti_slop: {
            score: 97,
            summary: 'Zero cliché copy hits, zero unfinished markers, and balanced module decomposition.',
            strengths: [
              'Pass 1 recorded totalSlopHits: 0 and todoCount: 0 across 38 files.',
              'Largest file stays well below the 800 LOC monolith ceiling at 312 LOC.',
            ],
            deductions: [
              'Minor redundant TypeScript re-exports in src/index.ts.',
            ],
          },
          creativity: {
            score: 90,
            summary: 'Introduces deterministic vector-clock pruning tuned for browser tab lifecycles.',
            strengths: [
              'src/engine/tabLease.ts uses BroadcastChannel leader election without polling.',
              'Interactive conflict replay sandbox in src/demo/ReplayBench.tsx.',
            ],
            deductions: [
              'Public API surface mirrors established React Query conventions.',
            ],
          },
          marketability: {
            score: 84,
            summary: 'Sharp technical positioning and fast above-the-fold H1, though sharing loops are minimal.',
            strengths: [
              'H1 communicates value proposition in 6 words.',
              'Live interactive benchmark provides immediate proof on first visit.',
            ],
            deductions: [
              'No shareable benchmark permalink or README badge generator for adopters.',
            ],
          },
        },
        roastVerdict:
          'Disciplined IndexedDB conflict resolution and strict schema guards shine, though onboarding docs assume prior CRDT fluency.',
        topFixes: [
          'Add automatic IndexedDB quota eviction fallback in src/worker/storageWorker.ts.',
          'Provide a 5-minute starter CLI scaffold for teams unfamiliar with vector clocks.',
          'Export shareable benchmark snapshot links from src/demo/ReplayBench.tsx.',
        ],
      },
      fileManifest: [
        { path: 'package.json', loc: 48 },
        { path: 'README.md', loc: 142 },
        { path: 'src/engine/deltaReconciler.ts', loc: 312 },
        { path: 'src/engine/tabLease.ts', loc: 184 },
        { path: 'src/worker/storageWorker.ts', loc: 220 },
      ],
      evaluatedAt: '2026-11-24T16:40:00.000Z',
      judgeModel: 'gemini-4-hydrogen',
    },
  }),
  createReferenceAudit({
    id: 'ref-querydiff-cli',
    repoSlug: 'dbcraft/querydiff',
    commitSha: '4c8b1d9e0f2a3b4c5d6e7f8091a2b3c4d5e6f708',
    liveUrl: 'https://querydiff.example.dev',
    bundleHash: '1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f8091',
    roastVerdict:
      'Rock-solid PostgreSQL EXPLAIN diffing for CI pull requests, held back by sparse landing page social proof.',
    pillarScores: {
      functionality: 86,
      usefulness: 88,
      anti_slop: 91,
      creativity: 78,
      marketability: 74,
    },
    slopHitCount: 0,
    isPublic: true,
    createdAt: '2026-11-23T19:15:00.000Z',
    fullReport: {
      pass1: {
        totalFiles: 24,
        totalLoc: 2940,
        largestFile: { path: 'src/parser/explainTree.ts', loc: 390, isMonolith: false },
        todoCount: 1,
        consoleLogCount: 2,
        resilience: {
          hasEnvLeak: false,
          hasRateLimiting: true,
          hasErrorBoundary: true,
          hasInputValidation: true,
        },
        wrapperRatio: { llmCallFiles: 0, businessLogicFiles: 19, ratio: 0 },
        slopHits: [],
        totalSlopHits: 0,
        weightedSlopPenalty: 0,
        liveProbe: {
          url: 'https://querydiff.example.dev',
          httpStatus: 200,
          ttfbMs: 142,
          title: 'QueryDiff — CI Regression Checks for SQL Plans',
          metaDescription: 'Catch sequential scan regressions before merging migrations.',
          h1Text: 'Catch slow SQL plans in pull requests',
          ctaText: ['Install GitHub Action', 'View Sample Diff'],
          consoleErrors: [],
          failedRequests: 0,
          hasViewportMeta: true,
        },
      },
      pass2: {
        pillars: {
          functionality: {
            score: 86,
            summary: 'Clean recursive EXPLAIN JSON parser with reliable exit-code gating.',
            strengths: [
              'src/parser/explainTree.ts handles nested hash and merge joins cleanly.',
              'Zod schema validation protects CLI config ingestion in src/config.ts.',
            ],
            deductions: [
              '2 stray console.log statements remain in src/github/commenter.ts.',
            ],
          },
          usefulness: {
            score: 88,
            summary: 'Directly prevents production database latency incidents during code review.',
            strengths: [
              'Zero-config GitHub Action workflow posts plan cost deltas directly on PRs.',
            ],
            deductions: [
              'Requires manual seed fixtures for ephemeral CI Postgres containers.',
            ],
          },
          anti_slop: {
            score: 91,
            summary: 'Zero marketing clichés and purposeful, compact modules.',
            strengths: [
              'Pass 1 verified 0 slop lexicon hits across Markdown and TSX files.',
            ],
            deductions: [
              '1 unfinished marker in src/parser/explainTree.ts for CTE materialization.',
            ],
          },
          creativity: {
            score: 78,
            summary: 'Clear terminal diff visualization, though conceptually adjacent to existing linters.',
            strengths: [
              'Color-coded cost delta bars in PR comments make regressions obvious.',
            ],
            deductions: [
              'No interactive browser plan visualizer for ad-hoc debugging.',
            ],
          },
          marketability: {
            score: 74,
            summary: 'Direct H1 and clear GitHub Action distribution, but lacks pricing clarity.',
            strengths: [
              'PR comment badge drives organic team adoption.',
            ],
            deductions: [
              'Landing page omits concrete latency benchmarks or enterprise team tiers.',
            ],
          },
        },
        roastVerdict:
          'Rock-solid PostgreSQL EXPLAIN diffing for CI pull requests, held back by sparse landing page social proof.',
        topFixes: [
          'Remove leftover console.log calls from src/github/commenter.ts.',
          'Add CTE materialization cost tracking in src/parser/explainTree.ts.',
          'Publish a live interactive sample PR diff on the landing page.',
        ],
      },
      fileManifest: [
        { path: 'package.json', loc: 41 },
        { path: 'README.md', loc: 98 },
        { path: 'src/parser/explainTree.ts', loc: 390 },
        { path: 'src/github/commenter.ts', loc: 145 },
      ],
      evaluatedAt: '2026-11-23T19:15:00.000Z',
      judgeModel: 'gemini-4-hydrogen',
    },
  }),
  createReferenceAudit({
    id: 'ref-invoice-snap',
    repoSlug: 'weekend-labs/invoicesnap',
    commitSha: '7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e',
    liveUrl: 'https://invoicesnap.example.dev',
    bundleHash: '5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3',
    roastVerdict:
      'Works for quick freelance PDF invoices, yet monolithic form state and crowded SaaS clichés cap its polish.',
    pillarScores: {
      functionality: 64,
      usefulness: 66,
      anti_slop: 56,
      creativity: 52,
      marketability: 60,
    },
    slopHitCount: 3,
    isPublic: true,
    createdAt: '2026-11-22T11:20:00.000Z',
    fullReport: {
      pass1: {
        totalFiles: 14,
        totalLoc: 1980,
        largestFile: { path: 'src/pages/InvoiceBuilder.tsx', loc: 842, isMonolith: true },
        todoCount: 4,
        consoleLogCount: 9,
        resilience: {
          hasEnvLeak: false,
          hasRateLimiting: false,
          hasErrorBoundary: false,
          hasInputValidation: true,
        },
        wrapperRatio: { llmCallFiles: 1, businessLogicFiles: 8, ratio: 0.11 },
        slopHits: [
          { filePath: 'src/pages/Landing.tsx', phrase: 'seamlessly', count: 2, weight: 3 },
          { filePath: 'README.md', phrase: 'supercharge', count: 1, weight: 4 },
        ],
        totalSlopHits: 3,
        weightedSlopPenalty: 10,
        liveProbe: {
          url: 'https://invoicesnap.example.dev',
          httpStatus: 200,
          ttfbMs: 390,
          title: 'InvoiceSnap — Freelance Invoicing',
          metaDescription: 'Create PDF invoices in seconds.',
          h1Text: 'Create clean invoices without spreadsheets',
          ctaText: ['Start Free', 'Download Sample'],
          consoleErrors: ['Warning: validateDOMNesting in LineItemRow'],
          failedRequests: 0,
          hasViewportMeta: true,
        },
      },
      pass2: {
        pillars: {
          functionality: {
            score: 64,
            summary: 'Core PDF export runs reliably, but lacks ErrorBoundary and carries a DOM nesting warning.',
            strengths: [
              'Zod line-item math validation prevents NaN invoice totals in src/lib/calc.ts.',
            ],
            deductions: [
              'src/pages/InvoiceBuilder.tsx is an 842-LOC monolith mixing PDF layout and form state.',
              'Missing React ErrorBoundary and rate limiting on PDF export endpoint.',
            ],
          },
          usefulness: {
            score: 66,
            summary: 'Solves ad-hoc invoicing for solo contractors with low time-to-value.',
            strengths: [
              'Generates a downloadable PDF within 3 clicks without forced signup.',
            ],
            deductions: [
              'No recurring client templates or tax rate presets for repeat billing.',
            ],
          },
          anti_slop: {
            score: 56,
            summary: 'Monolith file, 9 console.logs, 4 unfinished markers, and 3 cliché hits drag craft down.',
            strengths: [
              'Real client-side PDF rendering logic rather than an AI wrapper.',
            ],
            deductions: [
              'Pass 1 flagged 3 cliché hits across src/pages/Landing.tsx and README.md.',
              '4 unfinished markers and 9 debug console.log calls left in production source.',
            ],
          },
          creativity: {
            score: 52,
            summary: 'Standard two-pane form-and-preview invoice generator.',
            strengths: [
              'Live currency rounding preview updates smoothly.',
            ],
            deductions: [
              'Layout and feature set closely mirror dozens of open-source invoice templates.',
            ],
          },
          marketability: {
            score: 60,
            summary: 'Clear H1 and instant free utility, though differentiation is thin.',
            strengths: [
              'Zero-signup trial reduces landing bounce.',
            ],
            deductions: [
              'No watermarked shareable payment link to drive organic referral loops.',
            ],
          },
        },
        roastVerdict:
          'Works for quick freelance PDF invoices, yet monolithic form state and crowded SaaS clichés cap its polish.',
        topFixes: [
          'Split src/pages/InvoiceBuilder.tsx (842 LOC) into LineItemsTable, TotalsPanel, and PdfPreview.',
          'Wrap application root in an ErrorBoundary and strip all 9 console.log statements.',
          'Rewrite cliché copy in src/pages/Landing.tsx with concrete freelancer time-savings.',
        ],
      },
      fileManifest: [
        { path: 'package.json', loc: 34 },
        { path: 'src/pages/InvoiceBuilder.tsx', loc: 842 },
        { path: 'src/pages/Landing.tsx', loc: 214 },
        { path: 'src/lib/calc.ts', loc: 88 },
      ],
      evaluatedAt: '2026-11-22T11:20:00.000Z',
      judgeModel: 'gemini-4-hydrogen',
    },
  }),
  createReferenceAudit({
    id: 'ref-nexus-prompt-wrapper',
    repoSlug: 'hype-builders/nexus-copy-ai',
    commitSha: '2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d',
    liveUrl: 'https://nexus-copy-ai.example.dev',
    bundleHash: '9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0',
    roastVerdict:
      'A 960-line single-prompt wrapper stuffed with 14 marketing clichés and zero input validation or error handling.',
    pillarScores: {
      functionality: 41,
      usefulness: 38,
      anti_slop: 18,
      creativity: 26,
      marketability: 42,
    },
    slopHitCount: 14,
    isPublic: true,
    createdAt: '2026-11-21T08:05:00.000Z',
    fullReport: {
      pass1: {
        totalFiles: 7,
        totalLoc: 1410,
        largestFile: { path: 'src/App.tsx', loc: 964, isMonolith: true },
        todoCount: 11,
        consoleLogCount: 23,
        resilience: {
          hasEnvLeak: false,
          hasRateLimiting: false,
          hasErrorBoundary: false,
          hasInputValidation: false,
        },
        wrapperRatio: { llmCallFiles: 2, businessLogicFiles: 1, ratio: 0.67 },
        slopHits: [
          { filePath: 'src/App.tsx', phrase: 'unleash', count: 4, weight: 5 },
          { filePath: 'src/App.tsx', phrase: 'game-changer', count: 3, weight: 5 },
          { filePath: 'src/App.tsx', phrase: 'elevate your', count: 3, weight: 4 },
          { filePath: 'README.md', phrase: 'revolutionize', count: 2, weight: 4 },
          { filePath: 'README.md', phrase: 'delve', count: 2, weight: 5 },
        ],
        totalSlopHits: 14,
        weightedSlopPenalty: 65,
        liveProbe: {
          url: 'https://nexus-copy-ai.example.dev',
          httpStatus: 200,
          ttfbMs: 910,
          title: 'NexusCopy AI — Next-Gen Marketing',
          metaDescription: 'Transform your workflow today.',
          h1Text: 'Next-Gen AI Copy Engine',
          ctaText: ['Get Started', 'Upgrade Pro'],
          consoleErrors: ['Uncaught TypeError: Cannot read properties of undefined (reading text)'],
          failedRequests: 1,
          hasViewportMeta: true,
        },
      },
      pass2: {
        pillars: {
          functionality: {
            score: 41,
            summary: 'Crashes on empty prompt submission and lacks validation, rate limiting, and ErrorBoundary.',
            strengths: [
              'Basic prompt endpoint responds when given a well-formed string.',
            ],
            deductions: [
              'src/App.tsx packs 964 LOC into one component with 23 console.log calls.',
              'Live URL threw an uncaught TypeError and 1 failed network request.',
              'Pass 1 confirmed zero input validation and zero rate limiting.',
            ],
          },
          usefulness: {
            score: 38,
            summary: 'Thin textarea forwarding directly to a single un-tuned system prompt.',
            strengths: [
              'Outputs basic social post drafts when backend succeeds.',
            ],
            deductions: [
              'Wrapper ratio is 0.67 with only 1 tiny business logic helper.',
              'Users get identical results pasting directly into a general chat window.',
            ],
          },
          anti_slop: {
            score: 18,
            summary: 'Textbook AI slop: 14 weighted cliché hits, 11 unfinished markers, and 964-LOC monolith.',
            strengths: [
              'No hardcoded API keys detected in committed source.',
            ],
            deductions: [
              'Pass 1 weightedSlopPenalty hit 65 across src/App.tsx and README.md.',
              '11 leftover unfinished markers remain throughout src/App.tsx.',
            ],
          },
          creativity: {
            score: 26,
            summary: 'Indistinguishable from stock boilerplate landing page templates.',
            strengths: [
              'Includes a tone dropdown selector.',
            ],
            deductions: [
              'No proprietary brand voice memory, diffing, or workflow integration.',
            ],
          },
          marketability: {
            score: 42,
            summary: 'Generic buzzword headline obscures who the product is actually built for.',
            strengths: [
              'Clear pricing section structure exists.',
            ],
            deductions: [
              'H1 fails the 5-second clarity test and repeats banned cliché phrasing.',
            ],
          },
        },
        roastVerdict:
          'A 960-line single-prompt wrapper stuffed with 14 marketing clichés and zero input validation or error handling.',
        topFixes: [
          'Delete the 14 cliché phrases in src/App.tsx and README.md and state a concrete ICP.',
          'Break src/App.tsx (964 LOC) into modular components and add Zod validation + rate limiting.',
          'Build real domain logic such as brand-style-guide linting instead of a raw prompt proxy.',
        ],
      },
      fileManifest: [
        { path: 'package.json', loc: 29 },
        { path: 'src/App.tsx', loc: 964 },
        { path: 'api/generate.ts', loc: 44 },
        { path: 'README.md', loc: 86 },
      ],
      evaluatedAt: '2026-11-21T08:05:00.000Z',
      judgeModel: 'gemini-4-hydrogen',
    },
  }),
  createReferenceAudit({
    id: 'ref-vapor-chain-os',
    repoSlug: 'stealth-labs/hyperchain-os',
    commitSha: '00112233445566778899aabbccddeeff00112233',
    liveUrl: 'https://hyperchain-os.example.dev',
    bundleHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    roastVerdict:
      'Broken live deployment returning HTTP 500 backed by empty waitlist forms and zero implemented product routes.',
    pillarScores: {
      functionality: 14,
      usefulness: 16,
      anti_slop: 15,
      creativity: 22,
      marketability: 24,
    },
    slopHitCount: 11,
    isPublic: true,
    createdAt: '2026-11-20T14:50:00.000Z',
    fullReport: {
      pass1: {
        totalFiles: 5,
        totalLoc: 430,
        largestFile: { path: 'src/index.html', loc: 215, isMonolith: false },
        todoCount: 16,
        consoleLogCount: 6,
        resilience: {
          hasEnvLeak: false,
          hasRateLimiting: false,
          hasErrorBoundary: false,
          hasInputValidation: false,
        },
        wrapperRatio: { llmCallFiles: 0, businessLogicFiles: 0, ratio: 0 },
        slopHits: [
          { filePath: 'src/index.html', phrase: 'cutting-edge', count: 4, weight: 3 },
          { filePath: 'src/index.html', phrase: 'tapestry', count: 3, weight: 5 },
          { filePath: 'README.md', phrase: 'unlock the power', count: 4, weight: 4 },
        ],
        totalSlopHits: 11,
        weightedSlopPenalty: 43,
        liveProbe: {
          url: 'https://hyperchain-os.example.dev',
          httpStatus: 500,
          ttfbMs: 1420,
          title: '',
          metaDescription: '',
          h1Text: '',
          ctaText: [],
          consoleErrors: ['HTTP 500 returned from hyperchain-os.example.dev', 'Missing <title> tag in HTML document head'],
          failedRequests: 1,
          hasViewportMeta: false,
        },
      },
      pass2: {
        pillars: {
          functionality: {
            score: 14,
            summary: 'Live URL fails with HTTP 500 and repository contains zero working product logic.',
            strengths: [
              'Package manifest parses without syntax errors.',
            ],
            deductions: [
              'Live URL returned HTTP 500 with missing <title> and viewport meta.',
              'Zero business logic files detected in Pass 1 metrics.',
            ],
          },
          usefulness: {
            score: 16,
            summary: 'Only an un-wired waitlist input exists; no deliverable workflow.',
            strengths: [
              'README outlines an aspirational problem space.',
            ],
            deductions: [
              'Waitlist submit handler in src/index.html performs no network call.',
            ],
          },
          anti_slop: {
            score: 15,
            summary: '11 cliché hits and 16 unfinished markers across just 5 files.',
            strengths: [
              'Small repository footprint makes a full rewrite easy.',
            ],
            deductions: [
              'Pass 1 flagged 43 weighted slop penalty points and 16 unfinished markers.',
            ],
          },
          creativity: {
            score: 22,
            summary: 'Buzzword-heavy manifesto without verifiable product mechanics.',
            strengths: [
              'Custom color theme tokens exist in CSS.',
            ],
            deductions: [
              'No working demo, schema, or original interaction pattern.',
            ],
          },
          marketability: {
            score: 24,
            summary: 'Broken production URL immediately kills visitor trust.',
            strengths: [
              'Short memorable repository slug.',
            ],
            deductions: [
              'HTTP 500 response and missing metadata break social previews and search indexing.',
            ],
          },
        },
        roastVerdict:
          'Broken live deployment returning HTTP 500 backed by empty waitlist forms and zero implemented product routes.',
        topFixes: [
          'Fix the HTTP 500 deployment failure and add proper HTML title and viewport tags.',
          'Implement at least one working core user workflow before publishing.',
          'Strip the 11 marketing clichés and 16 unfinished stubs across src/index.html and README.md.',
        ],
      },
      fileManifest: [
        { path: 'package.json', loc: 22 },
        { path: 'src/index.html', loc: 215 },
        { path: 'README.md', loc: 112 },
      ],
      evaluatedAt: '2026-11-20T14:50:00.000Z',
      judgeModel: 'gemini-4-hydrogen',
    },
  }),
];
