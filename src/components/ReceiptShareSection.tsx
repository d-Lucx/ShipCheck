import { useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Share2 } from 'lucide-react';
import type { Tier } from '../../packages/core/src/index.ts';

type BadgeStyleOption = 'flat' | 'flat-square' | 'for-the-badge';
type SnippetFormat = 'markdown' | 'html' | 'url';

interface ReceiptShareSectionProps {
  auditId: string;
  repoSlug: string;
  overallScore: number;
  tier: Tier;
  origin: string;
  receiptUrl: string;
  badgePath: string;
  ogPath: string;
  ogImageUrl: string;
  ogMetaTagSnippet: string;
  xIntentUrl: string;
  linkedInIntentUrl: string;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
  onWebShare: (channel: 'x' | 'linkedin') => void;
}

export function ReceiptShareSection({
  auditId,
  repoSlug,
  overallScore,
  tier,
  origin,
  receiptUrl,
  badgePath,
  ogPath,
  ogImageUrl,
  ogMetaTagSnippet,
  xIntentUrl,
  linkedInIntentUrl,
  copiedKey,
  onCopy,
  onWebShare,
}: ReceiptShareSectionProps) {
  const [badgeStyle, setBadgeStyle] = useState<BadgeStyleOption>('flat');
  const [showTier, setShowTier] = useState(true);
  const [snippetFormat, setSnippetFormat] = useState<SnippetFormat>('markdown');

  const { configuredBadgePath, configuredBadgeUrl, snippetText, altText } = useMemo(() => {
    const params = new URLSearchParams();
    if (badgeStyle !== 'flat') params.set('style', badgeStyle);
    if (!showTier) params.set('showTier', 'false');
    params.set('auditId', auditId);

    const qs = params.toString();
    const relPath = qs ? `${badgePath}?${qs}` : badgePath;
    const fullUrl = `${origin}${relPath}`;
    const alt = showTier
      ? `ShipCheck: ${overallScore}/100 (${tier})`
      : `ShipCheck: ${overallScore}/100`;

    let snippet = `[![${alt}](${fullUrl})](${receiptUrl})`;
    if (snippetFormat === 'html') {
      snippet = `<a href="${receiptUrl}"><img src="${fullUrl}" alt="${alt}" /></a>`;
    } else if (snippetFormat === 'url') {
      snippet = fullUrl;
    }

    return {
      configuredBadgePath: relPath,
      configuredBadgeUrl: fullUrl,
      snippetText: snippet,
      altText: alt,
    };
  }, [auditId, badgePath, badgeStyle, origin, overallScore, receiptUrl, showTier, snippetFormat, tier]);

  const copyLabel =
    snippetFormat === 'markdown'
      ? 'Copy Markdown'
      : snippetFormat === 'html'
        ? 'Copy HTML'
        : 'Copy Badge URL';

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* GitHub README SVG Badge Generator */}
      <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-lg p-6 flex flex-col justify-between gap-5">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">
                GitHub README SVG Badge
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
                Embed this live SVG badge in your repository <code className="font-mono text-[#0F172A]">README.md</code> to display your verified audit score.
              </p>
            </div>
            <a
              href={configuredBadgePath}
              download={`shipcheck-${repoSlug.replace('/', '-')}.svg`}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#475569] hover:text-[#0F172A] whitespace-nowrap shrink-0"
              title="Download SVG file"
            >
              <Download className="w-3.5 h-3.5" />
              SVG
            </a>
          </div>

          {/* Live SVG Badge Preview */}
          <div className="py-5 px-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md flex flex-col items-center justify-center gap-2">
            <img
              src={configuredBadgePath}
              alt={altText}
              referrerPolicy="no-referrer"
              className={badgeStyle === 'for-the-badge' ? 'h-7' : 'h-[22px]'}
            />
            <span className="text-[11px] font-mono text-[#64748B]">
              {repoSlug} · {overallScore}/100 · {tier}
            </span>
          </div>

          {/* Badge Customization Controls */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-[#475569]">Badge Style</span>
              <div
                role="group"
                aria-label="SVG badge style"
                className="flex items-center gap-1 p-0.5 bg-[#F1F5F9] rounded-md"
              >
                {(
                  [
                    { id: 'flat', label: 'Flat' },
                    { id: 'flat-square', label: 'Square' },
                    { id: 'for-the-badge', label: 'Bold' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBadgeStyle(opt.id)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      badgeStyle === opt.id
                        ? 'bg-white text-[#0F172A] shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-xs font-medium text-[#475569]">
                Include tier label ({tier})
              </span>
              <input
                type="checkbox"
                checked={showTier}
                onChange={(e) => setShowTier(e.target.checked)}
                className="accent-[#0F172A]"
              />
            </label>
          </div>
        </div>

        {/* Copyable Markdown / HTML / URL Snippet */}
        <div className="space-y-2.5 pt-3 border-t border-[#F1F5F9]">
          <div className="flex items-center justify-between gap-2">
            <div
              role="tablist"
              aria-label="Badge snippet format"
              className="flex items-center gap-1 p-0.5 bg-[#F1F5F9] rounded-md"
            >
              {(
                [
                  { id: 'markdown', label: 'Markdown' },
                  { id: 'html', label: 'HTML' },
                  { id: 'url', label: 'SVG URL' },
                ] as const
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  role="tab"
                  aria-selected={snippetFormat === fmt.id}
                  onClick={() => setSnippetFormat(fmt.id)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    snippetFormat === fmt.id
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onCopy(`badge-${snippetFormat}`, snippetText)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0F172A] text-white rounded-md hover:bg-[#1E293B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedKey === `badge-${snippetFormat}` ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#4ADE80]" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  {copyLabel}
                </>
              )}
            </button>
          </div>

          <pre className="p-3 bg-[#0F172A] text-[#E2E8F0] rounded-md text-[11px] font-mono overflow-x-auto leading-relaxed">
            {snippetText}
          </pre>

          <p className="text-[11px] text-[#64748B] font-mono truncate" title={configuredBadgeUrl}>
            Endpoint: {configuredBadgePath}
          </p>
        </div>
      </div>

      {/* Share & OpenGraph Receipt Card */}
      <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">
              Share &amp; OpenGraph Receipt Card (1200×630)
            </h2>
            <p className="text-xs text-[#64748B]">
              Share via Web Share API or embed the generated OpenGraph image URL on X and LinkedIn
            </p>
          </div>
          <a
            href={ogPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline whitespace-nowrap shrink-0"
          >
            Open SVG
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="border border-[#E2E8F0] rounded-md overflow-hidden bg-[#0B1120]">
          <img
            src={ogPath}
            alt={`OpenGraph receipt card for ${repoSlug}`}
            referrerPolicy="no-referrer"
            className="w-full h-auto block"
          />
        </div>

        {/* Share Controls for X and LinkedIn */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => onWebShare('x')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#0F172A] text-white rounded-md hover:bg-[#1E293B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            {copiedKey === 'share-x' ? 'Copied X Post' : 'Share to X'}
          </button>
          <a
            href={xIntentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-[#334155] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] transition-colors whitespace-nowrap shrink-0"
          >
            Open on X
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={() => onWebShare('linkedin')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#0A66C2] text-white rounded-md hover:bg-[#004182] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            {copiedKey === 'share-linkedin' ? 'Copied LinkedIn Post' : 'Share to LinkedIn'}
          </button>
          <a
            href={linkedInIntentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-[#334155] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] transition-colors whitespace-nowrap shrink-0"
          >
            Open on LinkedIn
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Generated OpenGraph Meta Tag Image URL & HTML Meta Tags */}
        <div className="space-y-3 pt-3 border-t border-[#F1F5F9]">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#475569]">OpenGraph Image URL</span>
              <button
                type="button"
                onClick={() => onCopy('og-url', ogImageUrl)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
              >
                {copiedKey === 'og-url' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied URL
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Image URL
                  </>
                )}
              </button>
            </div>
            <div className="px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md font-mono text-[11px] text-[#0F172A] break-all">
              {ogImageUrl}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#475569]">OpenGraph Meta Tags</span>
              <button
                type="button"
                onClick={() => onCopy('og-meta', ogMetaTagSnippet)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
              >
                {copiedKey === 'og-meta' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied Meta Tags
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Meta Tags
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-[#0F172A] text-[#E2E8F0] rounded-md text-[11px] font-mono overflow-x-auto leading-relaxed">
              {ogMetaTagSnippet}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
