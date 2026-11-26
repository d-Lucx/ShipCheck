import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CliCiView() {
  const [liveUrl, setLiveUrl] = useState('https://app.example.com');
  const [includeUrl, setIncludeUrl] = useState(true);
  const [publishFlag, setPublishFlag] = useState(true);
  const [ciFlag, setCiFlag] = useState(false);
  const [failUnder, setFailUnder] = useState(75);
  const [provider, setProvider] = useState<'gemini' | 'openai' | 'anthropic'>('gemini');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const cliCommand = useMemo(() => {
    const parts = ['npx shipcheck audit'];
    if (includeUrl && liveUrl.trim()) parts.push(`--url ${liveUrl.trim()}`);
    if (publishFlag) parts.push('--publish');
    if (ciFlag) parts.push('--ci');
    if (failUnder > 0) parts.push(`--fail-under ${failUnder}`);
    if (provider !== 'gemini') parts.push(`--provider ${provider}`);
    return parts.join(' ');
  }, [includeUrl, liveUrl, publishFlag, ciFlag, failUnder, provider]);

  const githubWorkflowYaml = useMemo(
    () => `name: ShipCheck Quality Gate

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  shipcheck:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Run ShipCheck two-pass benchmark
        env:
          SHIPCHECK_API_URL: \${{ secrets.SHIPCHECK_API_URL }}
        run: |
          npx shipcheck audit \\
            ${includeUrl && liveUrl.trim() ? `--url "${liveUrl.trim()}" \\\n            ` : ''}${publishFlag ? '--publish \\\n            ' : ''}--ci \\
            --fail-under ${failUnder} \\
            --provider ${provider}`,
    [includeUrl, liveUrl, publishFlag, failUnder, provider]
  );

  const copySnippet = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 space-y-8">
      <section className="max-w-3xl pb-6 border-b border-[#E2E8F0]">
        <p className="text-xs font-mono text-[#64748B] mb-2">
          packages/cli · Local Diagnostics · CI Pull-Request Gating
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] text-balance">
          CLI &amp; GitHub Action Integration
        </h1>
        <p className="text-sm text-[#475569] mt-3 leading-relaxed">
          Run ShipCheck locally before opening a pull request or enforce a minimum quality floor in
          CI. Non-compliant PRs exit with status code 1 and print exact file-level fixes.
        </p>
      </section>

      {/* Interactive CLI Builder */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-5">
          <h2 className="text-base font-semibold text-[#0F172A]">Configure CLI Flags</h2>

          <div className="space-y-4 text-sm">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-xs font-medium text-[#334155]">Probe Live URL (--url)</span>
              <input
                type="checkbox"
                checked={includeUrl}
                onChange={(e) => setIncludeUrl(e.target.checked)}
                className="accent-[#0F172A]"
              />
            </label>

            {includeUrl && (
              <input
                type="url"
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F172A]"
              />
            )}

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-xs font-medium text-[#334155]">
                Publish to Leaderboard (--publish)
              </span>
              <input
                type="checkbox"
                checked={publishFlag}
                onChange={(e) => setPublishFlag(e.target.checked)}
                className="accent-[#0F172A]"
              />
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-xs font-medium text-[#334155]">
                Machine JSON Output (--ci)
              </span>
              <input
                type="checkbox"
                checked={ciFlag}
                onChange={(e) => setCiFlag(e.target.checked)}
                className="accent-[#0F172A]"
              />
            </label>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="fail-under" className="font-medium text-[#334155]">
                  PR Gate Threshold (--fail-under)
                </label>
                <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                  {failUnder}/100
                </span>
              </div>
              <input
                id="fail-under"
                type="range"
                min={0}
                max={95}
                step={5}
                value={failUnder}
                onChange={(e) => setFailUnder(Number(e.target.value))}
                className="w-full accent-[#0F172A] cursor-pointer"
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <label htmlFor="byok-provider" className="block text-xs font-medium text-[#334155]">
                Pass 2 Judge Provider (--provider)
              </label>
              <select
                id="byok-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as 'gemini' | 'openai' | 'anthropic')}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F172A]"
              >
                <option value="gemini">gemini (Default — gemini-4-hydrogen)</option>
                <option value="openai">openai (BYOK local key)</option>
                <option value="anthropic">anthropic (BYOK local key)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#0F172A] text-[#E2E8F0] rounded-lg p-6 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#1E293B]">
              <span className="text-xs font-mono text-[#94A3B8]">Generated Command</span>
              <button
                type="button"
                onClick={() => void copySnippet('cli', cliCommand)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E2E8F0] hover:text-white cursor-pointer"
              >
                {copiedId === 'cli' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Command
                  </>
                )}
              </button>
            </div>

            <pre className="text-xs font-mono text-[#F8FAFC] overflow-x-auto whitespace-pre-wrap break-all">
              $ {cliCommand}
            </pre>

            <div className="pt-3 border-t border-[#1E293B]">
              <div className="text-[11px] font-mono text-[#94A3B8] mb-2">
                Sample Terminal Diagnostic Output
              </div>
              <pre className="text-xs font-mono text-[#CBD5E1] leading-relaxed overflow-x-auto">
{`ShipCheck Benchmark Report
Repository : shipcheck/shipcheck @ 9f4e2c1
Bundle SHA : 8e4a91f3b20c64d8...
Score      : 89/100 (Ship-Ready)

  Functionality   ██████████████████░░   90/100 (25%)
  Usefulness      █████████████████░░░   88/100 (25%)
  Anti-Slop       ███████████████████░   96/100 (20%)
  Creativity      █████████████████░░░   85/100 (15%)
  Marketability   █████████████████░░░   86/100 (15%)

Pass 1 Metrics: 26 files · 3,420 LOC · Largest: AuditReceiptView.tsx (392 LOC)
Hygiene       : 0 slop hits · 0 unfinished markers · 0 console.logs
Resilience    : ErrorBoundary=true · Validation=true · RateLimit=true · EnvLeak=false`}
              </pre>
            </div>
          </div>

          <div className="text-[11px] font-mono text-[#94A3B8] pt-3 border-t border-[#1E293B]">
            Local monorepo run: <span className="text-[#E2E8F0]">npm run shipcheck -- audit --fail-under {failUnder}</span>
          </div>
        </div>
      </section>

      {/* GitHub Action Workflow Template */}
      <section className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">
              GitHub Actions Workflow Template
            </h2>
            <p className="text-xs text-[#64748B] font-mono mt-0.5">
              .github/workflows/shipcheck.yml
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copySnippet('yaml', githubWorkflowYaml)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#0F172A] text-white rounded-md hover:bg-[#1E293B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedId === 'yaml' ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied YAML
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Workflow YAML
              </>
            )}
          </button>
        </div>
        <pre className="p-6 bg-[#0F172A] text-[#E2E8F0] text-xs font-mono leading-relaxed overflow-x-auto">
          {githubWorkflowYaml}
        </pre>
      </section>
    </div>
  );
}
