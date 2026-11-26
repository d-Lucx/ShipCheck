import { useMemo, useState, type ChangeEvent } from 'react';
import { Check, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import {
  getTierColor,
  scanFilesDeterministically,
  type AuditRecord,
  type SourceFileEntry,
} from '../../packages/core/src/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { publishAuditToFirestore } from '../lib/auditStore.ts';

interface AuditLabViewProps {
  onAuditCreated: (audit: AuditRecord) => void;
  onOpenReceipt: (auditId: string) => void;
}

type InputMode = 'github' | 'files' | 'workspace';

interface UploadedShot {
  label: 'desktop' | 'mobile';
  name: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  base64Data: string;
}

const DEFAULT_SAMPLE_FILES: SourceFileEntry[] = [
  {
    path: 'package.json',
    content: JSON.stringify(
      {
        name: 'cron-guard',
        version: '1.2.0',
        dependencies: { express: '^4.21.0', zod: '^4.0.0' },
      },
      null,
      2
    ),
  },
  {
    path: 'src/server.ts',
    content: `import express from 'express';
import { z } from 'zod';

const app = express();
const CheckSchema = z.object({ jobId: z.string().min(3), maxSeconds: z.number().int().positive() });

const hits = new Map<string, number[]>();
function rateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60000);
  if (recent.length >= 60) return false;
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

app.post('/api/heartbeat', (req, res) => {
  if (!rateLimit(req.ip || 'local')) return res.status(429).json({ error: 'Too many requests' });
  const parsed = CheckSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  return res.json({ recorded: true, jobId: parsed.data.jobId });
});
`,
  },
  {
    path: 'README.md',
    content: `# CronGuard

Lightweight dead-man switch for production background jobs.
Send an HTTP heartbeat when a cron task finishes; receive an alert if a scheduled window is missed.
`,
  },
];

export function AuditLabView({ onAuditCreated, onOpenReceipt }: AuditLabViewProps) {
  const { user, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<InputMode>('github');
  const [repoSlug, setRepoSlug] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [files, setFiles] = useState<SourceFileEntry[]>(DEFAULT_SAMPLE_FILES);
  const [customSlug, setCustomSlug] = useState('acme/cron-guard');
  const [screenshots, setScreenshots] = useState<UploadedShot[]>([]);

  const [running, setRunning] = useState(false);
  const [phaseNote, setPhaseNote] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AuditRecord | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  // Instant browser-side Pass 1 preview for Code & File Scanner mode
  const livePass1Preview = useMemo(() => {
    if (mode !== 'files') return null;
    return scanFilesDeterministically(files).metrics;
  }, [mode, files]);

  const handleScreenshotUpload = (
    label: 'desktop' | 'mobile',
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrorMessage('Screenshots must be PNG, JPEG, or WebP images.');
      return;
    }
    if (file.size > 2_500_000) {
      setErrorMessage('Screenshot must be under 2.5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
      if (!base64Data) return;
      setScreenshots((prev) => [
        ...prev.filter((s) => s.label !== label),
        {
          label,
          name: file.name,
          mimeType: file.type as UploadedShot['mimeType'],
          base64Data,
        },
      ]);
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleLocalFilesUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []).slice(0, 15);
    if (selected.length === 0) return;

    const loaded: SourceFileEntry[] = [];
    for (const file of selected) {
      if (file.size > 180_000) continue;
      const content = await file.text();
      loaded.push({ path: file.name, content });
    }
    if (loaded.length > 0) {
      setFiles((prev) => [...prev, ...loaded].slice(0, 25));
    }
  };

  const handleRunAudit = async () => {
    setErrorMessage(null);
    setResult(null);
    setPublishedId(null);
    setRunning(true);

    try {
      if (mode === 'workspace') {
        setPhaseNote('Pass 1 scanning workspace files · Pass 2 invoking calibrated judge...');
        const response = await fetch('/api/audit/workspace', { method: 'POST' });
        const data = (await response.json()) as AuditRecord & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || 'Workspace self-audit failed.');
        }
        setResult(data);
        onAuditCreated(data);
        return;
      }

      if (mode === 'github') {
        const cleanedSlug = repoSlug.trim();
        if (!cleanedSlug) {
          throw new Error('Enter a public GitHub repository in owner/repo format.');
        }
        setPhaseNote('Fetching GitHub tree · Running Pass 1 hygiene scan · Invoking Pass 2 judge...');
        const response = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'github',
            repoSlug: cleanedSlug,
            liveUrl: liveUrl.trim(),
            screenshots: screenshots.map(({ label, mimeType, base64Data }) => ({
              label,
              mimeType,
              base64Data,
            })),
          }),
        });
        const data = (await response.json()) as AuditRecord & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || 'GitHub repository audit failed.');
        }
        setResult(data);
        onAuditCreated(data);
        return;
      }

      // Mode: files
      if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(customSlug.trim())) {
        throw new Error('Repository slug must follow owner/repo format (for example, acme/cron-guard).');
      }
      const validFiles = files.filter((f) => f.path.trim() && f.content.trim());
      if (validFiles.length === 0) {
        throw new Error('Add at least one non-empty source file to audit.');
      }

      setPhaseNote('Hashing Pass 1 deterministic bundle · Running Pass 2 calibrated judge...');
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'files',
          repoSlug: customSlug.trim(),
          liveUrl: liveUrl.trim(),
          files: validFiles,
          screenshots: screenshots.map(({ label, mimeType, base64Data }) => ({
            label,
            mimeType,
            base64Data,
          })),
        }),
      });
      const data = (await response.json()) as AuditRecord & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'File audit failed.');
      }
      setResult(data);
      onAuditCreated(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Audit request failed.');
    } finally {
      setRunning(false);
      setPhaseNote('');
    }
  };

  const handlePublish = async () => {
    if (!result) return;
    setErrorMessage(null);
    const activeUser = user ?? (await signInWithGoogle());
    if (!activeUser) return;

    setPublishing(true);
    try {
      const saved = await publishAuditToFirestore(result, activeUser, true);
      setResult(saved);
      setPublishedId(saved.id);
      onAuditCreated(saved);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to publish receipt.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 space-y-8">
      <section className="pb-6 border-b border-[#E2E8F0] flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-mono text-[#64748B] mb-2">
            Pass 1 Deterministic Scanner · Pass 2 Calibrated Multimodal Judge
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] text-balance">
            Run a Two-Pass Product Audit
          </h1>
          <p className="text-sm text-[#475569] mt-2 leading-relaxed">
            Inspect a public GitHub repository, evaluate local source files, or self-audit this
            ShipCheck workspace. Final scores are calculated deterministically in TypeScript.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Audit source mode"
          className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-md self-start lg:self-auto"
        >
          {(
            [
              { id: 'github', label: 'GitHub Repo' },
              { id: 'files', label: 'Paste / Upload Files' },
              { id: 'workspace', label: 'Self-Audit Workspace' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              onClick={() => {
                setMode(tab.id);
                setErrorMessage(null);
              }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === tab.id
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Input Form */}
        <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-6">
          {mode === 'github' && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="gh-repo"
                  className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                >
                  Public GitHub Repository (owner/repo)
                </label>
                <input
                  id="gh-repo"
                  type="text"
                  value={repoSlug}
                  onChange={(e) => setRepoSlug(e.target.value)}
                  placeholder="e.g. colinhacks/zod or https://github.com/owner/repo"
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div>
                <label
                  htmlFor="gh-url"
                  className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                >
                  Live Deployed URL (Optional — enables HTTP/DOM probe)
                </label>
                <input
                  id="gh-url"
                  type="url"
                  value={liveUrl}
                  onChange={(e) => setLiveUrl(e.target.value)}
                  placeholder="https://your-product.com"
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-[#CBD5E1] rounded-md text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A]"
                />
              </div>
            </div>
          )}

          {mode === 'files' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="custom-slug"
                    className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                  >
                    Repository Slug
                  </label>
                  <input
                    id="custom-slug"
                    type="text"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    placeholder="owner/repo"
                    className="w-full px-3 py-2 text-sm font-mono border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="files-url"
                    className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                  >
                    Live URL (Optional)
                  </label>
                  <input
                    id="files-url"
                    type="url"
                    value={liveUrl}
                    onChange={(e) => setLiveUrl(e.target.value)}
                    placeholder="https://your-product.com"
                    className="w-full px-3 py-2 text-sm font-mono border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-semibold text-[#0F172A]">
                  Source Files ({files.length})
                </span>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#334155] border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    Upload Files
                    <input
                      type="file"
                      multiple
                      onChange={(e) => void handleLocalFilesUpload(e)}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((prev) => [...prev, { path: `src/module${prev.length}.ts`, content: '' }])
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#0F172A] border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add File
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="border border-[#E2E8F0] rounded-md p-3 bg-[#F8FAFC] space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={file.path}
                        onChange={(e) => {
                          const next = [...files];
                          next[idx] = { ...file, path: e.target.value };
                          setFiles(next);
                        }}
                        placeholder="src/App.tsx"
                        className="flex-1 px-2.5 py-1 text-xs font-mono bg-white border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0F172A]"
                      />
                      {files.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove ${file.path}`}
                          onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-[#64748B] hover:text-[#DC2626] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={4}
                      value={file.content}
                      onChange={(e) => {
                        const next = [...files];
                        next[idx] = { ...file, content: e.target.value };
                        setFiles(next);
                      }}
                      placeholder="Paste file contents..."
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0F172A]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === 'workspace' && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-[#0F172A]">
                Self-Audit This ShipCheck Repository
              </h2>
              <p className="text-sm text-[#475569] leading-relaxed">
                Runs the full Pass 1 deterministic scanner (<code className="font-mono text-xs">packages/core</code>)
                against every source file in this workspace—checking LOC ceilings, slop lexicon hits,
                ErrorBoundary, Zod validation, and rate limiting—then grades the resulting bundle
                with the calibrated Pass 2 Gemini judge.
              </p>
              <div className="text-xs font-mono text-[#64748B] pt-1">
                Target: shipcheck/shipcheck · Excludes .env, node_modules, dist, and lockfiles
              </div>
            </div>
          )}

          {/* Optional Desktop/Mobile Multimodal Screenshots */}
          {mode !== 'workspace' && (
            <div className="pt-4 border-t border-[#F1F5F9] space-y-2.5">
              <div className="text-xs font-semibold text-[#0F172A]">
                Optional Visual Audit Screenshots (Desktop 1440×900 / Mobile 390×844)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['desktop', 'mobile'] as const).map((slot) => {
                  const attached = screenshots.find((s) => s.label === slot);
                  return (
                    <label
                      key={slot}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs border border-dashed border-[#CBD5E1] rounded-md bg-[#F8FAFC] hover:border-[#0F172A] cursor-pointer"
                    >
                      <span className="truncate text-[#475569]">
                        {attached ? `${slot}: ${attached.name}` : `Attach ${slot} screenshot`}
                      </span>
                      <Upload className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => handleScreenshotUpload(slot, e)}
                        className="hidden"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-md text-xs text-[#991B1B]">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-2">
            <span className="text-xs text-[#64748B]">
              {running ? phaseNote : 'Zero-cost Pass 1 runs before Pass 2 judge'}
            </span>
            <button
              type="button"
              disabled={running}
              onClick={() => void handleRunAudit()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#0F172A] text-white rounded-md hover:bg-[#1E293B] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Evaluating...
                </>
              ) : mode === 'workspace' ? (
                'Run Workspace Self-Audit'
              ) : (
                'Run Two-Pass Audit'
              )}
            </button>
          </div>
        </div>

        {/* Right: Live Pass 1 Telemetry or Evaluation Output */}
        <div className="lg:col-span-5 space-y-5">
          {result ? (
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-5">
              <div className="flex items-baseline justify-between gap-4 pb-4 border-b border-[#F1F5F9]">
                <div>
                  <div className="text-xs font-mono text-[#64748B]">{result.repoSlug}</div>
                  <div className="text-4xl font-bold font-mono text-[#0F172A] tabular-nums mt-1">
                    {result.overallScore}
                    <span className="text-base font-normal text-[#94A3B8]">/100</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${getTierColor(result.tier).textClass}`}>
                    {result.tier}
                  </div>
                  <div className="text-xs font-mono text-[#64748B] mt-0.5">
                    {result.slopHitCount} slop hits
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md text-xs text-[#0F172A] leading-relaxed">
                “{result.roastVerdict}”
              </div>

              <div className="grid grid-cols-5 gap-2 text-center font-mono">
                {(
                  [
                    ['Func', result.pillarScores.functionality],
                    ['Use', result.pillarScores.usefulness],
                    ['Slop', result.pillarScores.anti_slop],
                    ['Moat', result.pillarScores.creativity],
                    ['Mkt', result.pillarScores.marketability],
                  ] as const
                ).map(([label, score]) => (
                  <div key={label} className="bg-[#F8FAFC] rounded py-2">
                    <div className="text-[10px] text-[#64748B]">{label}</div>
                    <div className="text-sm font-bold text-[#0F172A] tabular-nums">{score}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                {publishedId ? (
                  <div className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0] rounded-md">
                    <Check className="w-4 h-4" />
                    Published to Leaderboard
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={publishing}
                    onClick={() => void handlePublish()}
                    className="w-full px-4 py-2.5 text-sm font-medium bg-[#0F172A] text-white rounded-md hover:bg-[#1E293B] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {publishing
                      ? 'Publishing Receipt...'
                      : user
                        ? 'Publish Receipt to Leaderboard'
                        : 'Sign In with Google & Publish'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onOpenReceipt(result.id)}
                  className="w-full px-4 py-2.5 text-sm font-medium text-[#0F172A] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                >
                  Open Full Receipt &amp; Badge
                </button>
              </div>
            </div>
          ) : livePass1Preview ? (
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A]">
                  Live Pass 1 Deterministic Preview
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Computed locally in real time before calling the Pass 2 judge
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-[#F1F5F9]">
                <div>
                  <dt className="text-[#64748B]">Files / LOC</dt>
                  <dd className="font-mono font-semibold text-[#0F172A] mt-0.5 tabular-nums">
                    {livePass1Preview.totalFiles} · {livePass1Preview.totalLoc}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#64748B]">Largest File</dt>
                  <dd className="font-mono font-semibold text-[#0F172A] mt-0.5 tabular-nums truncate">
                    {livePass1Preview.largestFile.loc} LOC ({livePass1Preview.largestFile.path})
                  </dd>
                </div>
                <div>
                  <dt className="text-[#64748B]">Slop Cliché Hits</dt>
                  <dd
                    className={`font-mono font-semibold mt-0.5 tabular-nums ${
                      livePass1Preview.totalSlopHits === 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                    }`}
                  >
                    {livePass1Preview.totalSlopHits} (penalty {livePass1Preview.weightedSlopPenalty})
                  </dd>
                </div>
                <div>
                  <dt className="text-[#64748B]">Resilience Flags</dt>
                  <dd className="font-mono text-[#0F172A] mt-0.5">
                    Zod:{livePass1Preview.resilience.hasInputValidation ? 'Y' : 'N'} · RL:
                    {livePass1Preview.resilience.hasRateLimiting ? 'Y' : 'N'} · EB:
                    {livePass1Preview.resilience.hasErrorBoundary ? 'Y' : 'N'}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-4">
              <h2 className="text-sm font-semibold text-[#0F172A]">Two-Pass Audit Pipeline</h2>
              <ol className="space-y-3 text-xs text-[#475569] leading-relaxed">
                <li>
                  <span className="font-semibold text-[#0F172A]">01. Deterministic Pass 1:</span>{' '}
                  Measures total LOC, monolith ceilings (&gt;800 LOC), exposed secret patterns,
                  ErrorBoundary, rate limiting, input validation, wrapper ratio, and weighted slop
                  lexicon hits.
                </li>
                <li>
                  <span className="font-semibold text-[#0F172A]">02. Bundle Compression &amp; SHA-256:</span>{' '}
                  Selects the top 12 highest-signal source files under an 18k-token cap and hashes
                  the commit SHA, manifest, and metrics into a tamper-evident fingerprint.
                </li>
                <li>
                  <span className="font-semibold text-[#0F172A]">03. Calibrated Judge Pass 2:</span>{' '}
                  Scores each pillar anchored at 50/100 with mandatory file and metric citations.
                  Overall score and tier are always computed deterministically in code.
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
