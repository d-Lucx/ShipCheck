import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Share2,
  Trash2,
} from 'lucide-react';
import {
  getTierColor,
  PILLAR_META,
  PILLAR_WEIGHTS,
  type AuditRecord,
  type PillarKey,
} from '../../packages/core/src/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  claimRepoOwnership,
  deleteAuditFromFirestore,
  toggleAuditVisibility,
} from '../lib/auditStore.ts';
import { exportAuditReceiptPdf } from '../lib/pdfReport.ts';
import { PillarRadarChart } from './PillarRadarChart.tsx';
import { ReceiptShareSection } from './ReceiptShareSection.tsx';

interface AuditReceiptViewProps {
  audit: AuditRecord;
  onBack: () => void;
  onDeleted?: (auditId: string) => void;
  onUpdated?: (audit: AuditRecord) => void;
}

const PILLAR_KEYS: PillarKey[] = [
  'functionality',
  'usefulness',
  'anti_slop',
  'creativity',
  'marketability',
];

function isSafeExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function upsertMetaTag(attr: 'property' | 'name', key: string, content: string): string | null {
  if (typeof document === 'undefined') return null;
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  const previous = el?.getAttribute('content') ?? null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  return previous;
}

export function AuditReceiptView({
  audit,
  onBack,
  onDeleted,
  onUpdated,
}: AuditReceiptViewProps) {
  const { user, signInWithGoogle } = useAuth();
  const captureRef = useRef<HTMLDivElement | null>(null);
  const [expandedPillar, setExpandedPillar] = useState<PillarKey | null>('functionality');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const tierColors = getTierColor(audit.tier);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const [owner, repo] = audit.repoSlug.split('/');
  const badgePath = `/api/badge/${encodeURIComponent(owner || 'repo')}/${encodeURIComponent(repo || 'app')}`;
  const ogPath = `/api/og/${encodeURIComponent(audit.id)}`;
  const ogImageUrl = `${origin}${ogPath}`;
  const receiptUrl = `${origin}/r/${audit.id}`;
  const defaultBadgeMarkdown = `[![ShipCheck: ${audit.overallScore}/100 (${audit.tier})](${origin}${badgePath}?auditId=${encodeURIComponent(audit.id)})](${receiptUrl})`;

  const shareTitle = `${audit.repoSlug} — ${audit.overallScore}/100 (${audit.tier}) | ShipCheck`;
  const xShareText = `${audit.repoSlug} scored ${audit.overallScore}/100 (${audit.tier}) on ShipCheck.\n\n"${audit.roastVerdict}"`;
  const linkedInShareText = `Verified ShipCheck Benchmark for ${audit.repoSlug}: ${audit.overallScore}/100 (${audit.tier}) · ${audit.slopHitCount} slop hits.\n\nVerdict: "${audit.roastVerdict}"\nOG Card: ${ogImageUrl}`;

  const xIntentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(xShareText)}&url=${encodeURIComponent(receiptUrl)}`;
  const linkedInIntentUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(receiptUrl)}`;

  const ogMetaTagSnippet = [
    `<meta property="og:title" content="${shareTitle.replace(/"/g, '&quot;')}" />`,
    `<meta property="og:description" content="${audit.roastVerdict.replace(/"/g, '&quot;')}" />`,
    `<meta property="og:image" content="${ogImageUrl}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${ogImageUrl}" />`,
  ].join('\n');

  // Synchronize document OpenGraph meta tags for this receipt
  useEffect(() => {
    const prevTitle = document.title;
    document.title = shareTitle;
    const prevOgTitle = upsertMetaTag('property', 'og:title', shareTitle);
    const prevOgDesc = upsertMetaTag('property', 'og:description', audit.roastVerdict);
    const prevOgImg = upsertMetaTag('property', 'og:image', ogImageUrl);
    const prevOgUrl = upsertMetaTag('property', 'og:url', receiptUrl);
    const prevTwImg = upsertMetaTag('name', 'twitter:image', ogImageUrl);

    return () => {
      document.title = prevTitle;
      if (prevOgTitle !== null) upsertMetaTag('property', 'og:title', prevOgTitle);
      if (prevOgDesc !== null) upsertMetaTag('property', 'og:description', prevOgDesc);
      if (prevOgImg !== null) upsertMetaTag('property', 'og:image', prevOgImg);
      if (prevOgUrl !== null) upsertMetaTag('property', 'og:url', prevOgUrl);
      if (prevTwImg !== null) upsertMetaTag('name', 'twitter:image', prevTwImg);
    };
  }, [shareTitle, audit.roastVerdict, ogImageUrl, receiptUrl]);

  const isOwner = Boolean(user && audit.authorUid && user.uid === audit.authorUid && !audit.isReference);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
      return true;
    } catch {
      setActionStatus('Clipboard permission denied in this browser.');
      return false;
    }
  };

  const handleWebShare = async (channel: 'native' | 'x' | 'linkedin') => {
    setActionStatus(null);
    const payload: ShareData =
      channel === 'x'
        ? { title: shareTitle, text: xShareText, url: receiptUrl }
        : channel === 'linkedin'
          ? { title: shareTitle, text: linkedInShareText, url: receiptUrl }
          : { title: shareTitle, text: xShareText, url: receiptUrl };

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(payload);
        setActionStatus(
          channel === 'x'
            ? 'Shared X post summary via Web Share API.'
            : channel === 'linkedin'
              ? 'Shared LinkedIn summary via Web Share API.'
              : 'Receipt shared via Web Share API.'
        );
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        // Fall through to clipboard copy fallback if Web Share is restricted in iframe
      }
    }

    const fallbackText =
      channel === 'linkedin'
        ? `${linkedInShareText}\n${receiptUrl}`
        : `${xShareText}\n${receiptUrl}`;
    const copied = await copyText(`share-${channel}`, fallbackText);
    if (copied) {
      setActionStatus(
        channel === 'x'
          ? 'Web Share unavailable here — copied X post and receipt URL to clipboard.'
          : channel === 'linkedin'
            ? 'Web Share unavailable here — copied LinkedIn post and OG card URL to clipboard.'
            : 'Web Share unavailable here — copied receipt summary and URL to clipboard.'
      );
    }
  };

  const handleDownloadPdf = async () => {
    if (!captureRef.current || exportingPdf) return;
    setExportingPdf(true);
    setActionStatus(null);
    try {
      const filename = await exportAuditReceiptPdf(audit, captureRef.current);
      setActionStatus(`Downloaded offline PDF report (${filename}).`);
    } catch (err) {
      setActionStatus(err instanceof Error ? err.message : 'PDF export failed.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (!isOwner) return;
    setBusy(true);
    setActionStatus(null);
    try {
      const nextVisibility = !audit.isPublic;
      await toggleAuditVisibility(audit.id, nextVisibility);
      onUpdated?.({ ...audit, isPublic: nextVisibility });
      setActionStatus(
        nextVisibility
          ? 'Receipt is now listed on the public leaderboard.'
          : 'Receipt is now unlisted (visible only to you).'
      );
    } catch (err) {
      setActionStatus(err instanceof Error ? err.message : 'Could not update visibility.');
    } finally {
      setBusy(false);
    }
  };

  const handleClaimRepo = async () => {
    if (audit.isReference) {
      setActionStatus('Run and publish a live audit of your repository first to claim ownership.');
      return;
    }
    const activeUser = user ?? (await signInWithGoogle());
    if (!activeUser) return;
    setBusy(true);
    setActionStatus(null);
    try {
      await claimRepoOwnership(audit.repoSlug, audit.id, activeUser);
      setActionStatus(`Claimed ${audit.repoSlug} under ${activeUser.email}.`);
    } catch (err) {
      setActionStatus(err instanceof Error ? err.message : 'Claim failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!isOwner) return;
    setBusy(true);
    try {
      await deleteAuditFromFirestore(audit.id);
      onDeleted?.(audit.id);
      onBack();
    } catch (err) {
      setActionStatus(err instanceof Error ? err.message : 'Could not delete receipt.');
      setBusy(false);
    }
  };

  const pass1 = audit.fullReport.pass1;
  const pass2 = audit.fullReport.pass2;

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-8">
      {/* Back navigation + receipt identity header */}
      <div className="space-y-4 pb-6 border-b border-[#E2E8F0]">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Leaderboard
        </button>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-[#64748B] flex flex-wrap items-center gap-2">
              <span>Receipt /r/{audit.id}</span>
              <span aria-hidden="true">·</span>
              <span>commit {audit.commitSha.slice(0, 7)}</span>
              <span aria-hidden="true">·</span>
              <span>sha256:{audit.bundleHash.slice(0, 16)}</span>
              {audit.isReference ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Reference Benchmark</span>
                </>
              ) : null}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] mt-1.5">
              {audit.repoSlug}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-[#475569]">
              <button
                type="button"
                onClick={() => void copyText('sha', audit.commitSha)}
                className="inline-flex items-center gap-1 font-mono hover:text-[#0F172A] cursor-pointer"
              >
                {copiedKey === 'sha' ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                Full SHA: {audit.commitSha.slice(0, 12)}...
              </button>
              {audit.liveUrl && isSafeExternalUrl(audit.liveUrl) ? (
                <a
                  href={audit.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#2563EB] hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {audit.liveUrl}
                </a>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={exportingPdf}
              onClick={() => void handleDownloadPdf()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#0F172A] text-white rounded-md hover:bg-[#1E293B] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {exportingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Exporting PDF...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Download as PDF
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => void handleWebShare('native')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-[#CBD5E1] text-[#0F172A] rounded-md hover:bg-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share Receipt
            </button>
            <button
              type="button"
              onClick={() => void copyText('header-badge', defaultBadgeMarkdown)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-[#CBD5E1] text-[#0F172A] rounded-md hover:bg-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedKey === 'header-badge' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                  Copied Badge MD
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy README Badge
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => void copyText('url', receiptUrl)}
              className="px-3.5 py-2 text-xs font-medium bg-white border border-[#CBD5E1] text-[#0F172A] rounded-md hover:bg-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedKey === 'url' ? 'Copied Receipt URL' : 'Copy Receipt Link'}
            </button>
            {!audit.isReference && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleClaimRepo()}
                className="px-3.5 py-2 text-xs font-medium bg-white border border-[#CBD5E1] text-[#0F172A] rounded-md hover:bg-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                Claim Repository
              </button>
            )}
            {isOwner && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleToggleVisibility()}
                  className="px-3.5 py-2 text-xs font-medium bg-white border border-[#CBD5E1] text-[#0F172A] rounded-md hover:bg-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {audit.isPublic ? 'Make Private' : 'Make Public'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDelete()}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium bg-white border border-[#FECACA] text-[#DC2626] rounded-md hover:bg-[#FEF2F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {actionStatus && (
          <p className="text-xs font-medium text-[#0F172A] bg-[#F1F5F9] px-3.5 py-2 rounded-md">
            {actionStatus}
          </p>
        )}
      </div>

      {/* Capturable Offline Report Region: Audit Summary + Radar Chart + Pass 1 Telemetry */}
      <div ref={captureRef} className="space-y-8">
      {/* Balanced 2-Column Overview: Score + Verdict | Radar Chart */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-lg p-6 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-baseline justify-between gap-4 pb-5 border-b border-[#F1F5F9]">
              <div>
                <div className="text-xs text-[#64748B] font-medium">Calibrated Overall Score</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-6xl font-bold font-mono tracking-tight text-[#0F172A] tabular-nums">
                    {audit.overallScore}
                  </span>
                  <span className="text-xl font-mono text-[#94A3B8]">/100</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[#64748B]">Deterministic Tier</div>
                <div className={`text-lg font-bold mt-1 ${tierColors.textClass}`}>
                  {audit.tier}
                </div>
                <div className="text-xs font-mono text-[#64748B] mt-0.5">
                  Judge: {audit.fullReport.judgeModel}
                </div>
              </div>
            </div>

            {/* Roast Verdict Callout (subtle surface + all-around hairline border, no left stripe) */}
            <div className="mt-5 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md">
              <div className="text-xs font-medium text-[#64748B] mb-1.5">Roast Verdict</div>
              <p className="text-[15px] font-medium text-[#0F172A] leading-relaxed">
                “{audit.roastVerdict}”
              </p>
            </div>
          </div>

          {/* Top 3 Actionable Fixes */}
          <div>
            <h2 className="text-xs font-semibold text-[#64748B] mb-3">
              Priority Fixes Cited From Source
            </h2>
            <ol className="space-y-2.5 text-sm text-[#334155]">
              {pass2.topFixes.map((fix, idx) => (
                <li key={idx} className="flex items-start gap-2.5 leading-snug">
                  <span className="font-mono text-xs font-semibold text-[#64748B] mt-0.5 shrink-0">
                    0{idx + 1}.
                  </span>
                  <span>{fix}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-lg p-6">
          <PillarRadarChart scores={audit.pillarScores} accentHex={tierColors.hex} />
        </div>
      </section>

      {/* Pass 1 Deterministic Scanner Metrics */}
      <section className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#F1F5F9]">
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">
              Pass 1 Deterministic Scanner Telemetry
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Zero-LLM static hygiene, resilience checks, and lexicon audit hashed into this receipt
            </p>
          </div>
          <div className="font-mono text-xs text-[#64748B] tabular-nums">
            Bundle SHA-256: {audit.bundleHash.slice(0, 24)}...
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
          <div>
            <div className="text-xs text-[#64748B]">Files / LOC</div>
            <div className="font-mono font-semibold text-[#0F172A] tabular-nums mt-0.5">
              {pass1.totalFiles} · {pass1.totalLoc.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#64748B]">Largest File</div>
            <div
              className={`font-mono font-semibold tabular-nums mt-0.5 ${
                pass1.largestFile.isMonolith ? 'text-[#DC2626]' : 'text-[#0F172A]'
              }`}
            >
              {pass1.largestFile.loc} LOC
            </div>
            <div className="text-[11px] font-mono text-[#64748B] truncate" title={pass1.largestFile.path}>
              {pass1.largestFile.path}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#64748B]">Slop Lexicon Hits</div>
            <div
              className={`font-mono font-semibold tabular-nums mt-0.5 ${
                pass1.totalSlopHits === 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
              }`}
            >
              {pass1.totalSlopHits} (wt {pass1.weightedSlopPenalty})
            </div>
          </div>
          <div>
            <div className="text-xs text-[#64748B]">Unfinished / Logs</div>
            <div className="font-mono font-semibold text-[#0F172A] tabular-nums mt-0.5">
              {pass1.todoCount} · {pass1.consoleLogCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#64748B]">Wrapper Ratio</div>
            <div className="font-mono font-semibold text-[#0F172A] tabular-nums mt-0.5">
              {Math.round(pass1.wrapperRatio.ratio * 100)}%
            </div>
            <div className="text-[11px] text-[#64748B]">
              {pass1.wrapperRatio.llmCallFiles} LLM / {pass1.wrapperRatio.businessLogicFiles} logic
            </div>
          </div>
          <div>
            <div className="text-xs text-[#64748B]">Resilience Checks</div>
            <div className="text-xs font-mono mt-1 space-y-0.5">
              <div className={pass1.resilience.hasErrorBoundary ? 'text-[#16A34A]' : 'text-[#B45309]'}>
                ErrorBoundary: {pass1.resilience.hasErrorBoundary ? 'Pass' : 'Missing'}
              </div>
              <div className={pass1.resilience.hasInputValidation ? 'text-[#16A34A]' : 'text-[#B45309]'}>
                Validation: {pass1.resilience.hasInputValidation ? 'Pass' : 'Missing'}
              </div>
              <div className={pass1.resilience.hasRateLimiting ? 'text-[#16A34A]' : 'text-[#B45309]'}>
                Rate Limit: {pass1.resilience.hasRateLimiting ? 'Pass' : 'Missing'}
              </div>
            </div>
          </div>
        </div>

        {/* Slop Hits exact file paths if any */}
        {pass1.slopHits.length > 0 && (
          <div className="pt-4 border-t border-[#F1F5F9]">
            <div className="text-xs font-semibold text-[#DC2626] mb-2">
              Deterministic Slop Lexicon Detections
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {pass1.slopHits.map((hit, i) => (
                <div
                  key={`${hit.filePath}-${hit.phrase}-${i}`}
                  className="flex items-center justify-between text-xs font-mono bg-[#FEF2F2] border border-[#FECACA] rounded px-3 py-1.5 text-[#991B1B]"
                >
                  <span className="truncate">{hit.filePath}</span>
                  <span className="shrink-0 ml-2">
                    &ldquo;{hit.phrase}&rdquo; ×{hit.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live URL probe metrics if available */}
        {pass1.liveProbe && (
          <div className="pt-4 border-t border-[#F1F5F9] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-[#64748B]">Live HTTP Status: </span>
              <span
                className={`font-mono font-semibold ${
                  pass1.liveProbe.httpStatus >= 200 && pass1.liveProbe.httpStatus < 400
                    ? 'text-[#16A34A]'
                    : 'text-[#DC2626]'
                }`}
              >
                {pass1.liveProbe.httpStatus || 'Unreachable'} · {pass1.liveProbe.ttfbMs}ms TTFB
              </span>
            </div>
            <div className="truncate">
              <span className="text-[#64748B]">Document H1: </span>
              <span className="text-[#0F172A] font-medium">
                {pass1.liveProbe.h1Text || 'Not detected'}
              </span>
            </div>
            <div>
              <span className="text-[#64748B]">Console / Network Issues: </span>
              <span className="font-mono font-semibold text-[#0F172A]">
                {pass1.liveProbe.consoleErrors.length} errors · {pass1.liveProbe.failedRequests} failed
              </span>
            </div>
          </div>
        )}
      </section>
      </div>

      {/* Expandable 5-Pillar Evidence Breakdown */}
      <section className="bg-white border border-[#E2E8F0] rounded-lg divide-y divide-[#E2E8F0]">
        <div className="p-6">
          <h2 className="text-base font-semibold text-[#0F172A]">
            Pass 2 Cited Pillar Evidence
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Inspect exact file references, DOM signals, and metric citations behind every score
          </p>
        </div>

        {PILLAR_KEYS.map((key) => {
          const evidence = pass2.pillars[key];
          const meta = PILLAR_META[key];
          const open = expandedPillar === key;
          const weightedPts = (evidence.score * PILLAR_WEIGHTS[key]).toFixed(1);

          return (
            <div key={key}>
              <button
                type="button"
                onClick={() => setExpandedPillar(open ? null : key)}
                className="w-full px-6 py-4 flex items-center justify-between gap-4 hover:bg-[#F8FAFC] transition-colors text-left cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#0F172A]">{meta.label}</span>
                    <span className="text-xs text-[#64748B] font-mono">
                      Weight {meta.weightPct}%
                    </span>
                  </div>
                  <p className="text-xs text-[#475569] mt-0.5 truncate">{evidence.summary}</p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-sm font-bold text-[#0F172A]">{evidence.score}/100</div>
                    <div className="text-[11px] text-[#64748B]">+{weightedPts} pts</div>
                  </div>
                  {open ? (
                    <ChevronUp className="w-4 h-4 text-[#64748B]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#64748B]" />
                  )}
                </div>
              </button>

              {open && (
                <div className="px-6 pb-5 pt-1 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#F8FAFC]/60 border-t border-[#F1F5F9]">
                  <div>
                    <h3 className="text-xs font-semibold text-[#16A34A] mb-2">
                      Verified Strengths ({evidence.strengths.length})
                    </h3>
                    <ul className="space-y-2 text-xs text-[#334155] leading-relaxed">
                      {evidence.strengths.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="font-mono text-[#16A34A] shrink-0">+</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-[#DC2626] mb-2">
                      Cited Deductions ({evidence.deductions.length})
                    </h3>
                    {evidence.deductions.length === 0 ? (
                      <p className="text-xs text-[#64748B]">
                        No deductions cited for this pillar.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-xs text-[#334155] leading-relaxed">
                        {evidence.deductions.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="font-mono text-[#DC2626] shrink-0">−</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <ReceiptShareSection
        auditId={audit.id}
        repoSlug={audit.repoSlug}
        overallScore={audit.overallScore}
        tier={audit.tier}
        origin={origin}
        receiptUrl={receiptUrl}
        badgePath={badgePath}
        ogPath={ogPath}
        ogImageUrl={ogImageUrl}
        ogMetaTagSnippet={ogMetaTagSnippet}
        xIntentUrl={xIntentUrl}
        linkedInIntentUrl={linkedInIntentUrl}
        copiedKey={copiedKey}
        onCopy={(key, text) => void copyText(key, text)}
        onWebShare={(channel) => void handleWebShare(channel)}
      />
    </div>
  );
}
