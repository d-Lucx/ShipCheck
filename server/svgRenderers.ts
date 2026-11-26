import { getTierColor, PILLAR_META, type AuditRecord, type PillarKey } from '../packages/core/src/index.ts';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(0, maxCharsPerLine - 3))}...`;
  }
  return lines;
}

export function renderBadgeSvg(params: {
  score: number | null;
  tier: string;
}): string {
  const leftLabel = 'ShipCheck';
  const rightLabel =
    params.score !== null ? `${params.score}/100 · ${params.tier}` : 'Unaudited';

  const tierColors: Record<string, string> = {
    'Apex Craft': '#15803D',
    'Ship-Ready': '#16A34A',
    'Weekend Hackathon': '#D97706',
    'Certified AI Slop': '#DC2626',
    Vaporware: '#991B1B',
  };
  const accent = tierColors[params.tier] ?? '#475569';

  const leftWidth = 78;
  const rightWidth = Math.max(110, Math.round(rightLabel.length * 6.8 + 22));
  const totalWidth = leftWidth + rightWidth;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="24" role="img" aria-label="${escapeXml(leftLabel)}: ${escapeXml(rightLabel)}">
  <title>${escapeXml(leftLabel)}: ${escapeXml(rightLabel)}</title>
  <clipPath id="r">
    <rect width="${totalWidth}" height="24" rx="4" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="24" fill="#0F172A"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="24" fill="${accent}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="11" font-weight="600">
    <text x="${Math.round(leftWidth / 2)}" y="15.5">${escapeXml(leftLabel)}</text>
    <text x="${leftWidth + Math.round(rightWidth / 2)}" y="15.5">${escapeXml(rightLabel)}</text>
  </g>
</svg>`;
}

export function renderOgReceiptSvg(audit: AuditRecord): string {
  const tierColor = getTierColor(audit.tier).hex;
  const pillars: PillarKey[] = [
    'functionality',
    'usefulness',
    'anti_slop',
    'creativity',
    'marketability',
  ];

  const verdictLines = wrapText(audit.roastVerdict, 56, 3);
  const shortSha = audit.commitSha.slice(0, 7);
  const shortHash = audit.bundleHash.slice(0, 16);

  const barRows = pillars
    .map((key, idx) => {
      const y = 264 + idx * 54;
      const score = audit.pillarScores[key];
      const barMaxWidth = 370;
      const barFillWidth = Math.max(4, Math.round((score / 100) * barMaxWidth));
      const barColor = score >= 75 ? '#22C55E' : score >= 50 ? '#F59E0B' : '#EF4444';
      const meta = PILLAR_META[key];

      return `
      <text x="610" y="${y}" fill="#CBD5E1" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="500">${escapeXml(meta.shortLabel)} (${meta.weightPct}%)</text>
      <text x="1136" y="${y}" text-anchor="end" fill="#F8FAFC" font-family="ui-monospace, monospace" font-size="16" font-weight="600">${score}/100</text>
      <rect x="610" y="${y + 11}" width="${barMaxWidth + 156}" height="10" rx="3" fill="#1E293B"/>
      <rect x="610" y="${y + 11}" width="${Math.round((barFillWidth / barMaxWidth) * (barMaxWidth + 156))}" height="10" rx="3" fill="${barColor}"/>`;
    })
    .join('\n');

  const verdictSvg = verdictLines
    .map(
      (line, idx) =>
        `<text x="64" y="${458 + idx * 30}" fill="#E2E8F0" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="400">${escapeXml(line)}</text>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0B1120"/>
  <rect x="28" y="28" width="1144" height="574" rx="12" fill="#0F172A" stroke="#1E293B" stroke-width="1.5"/>

  <!-- Header -->
  <text x="64" y="88" fill="#F8FAFC" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700" letter-spacing="-0.4">ShipCheck</text>
  <text x="200" y="88" fill="#64748B" font-family="ui-monospace, monospace" font-size="14">VERIFIED AUDIT RECEIPT</text>
  <text x="1136" y="88" text-anchor="end" fill="#94A3B8" font-family="ui-monospace, monospace" font-size="14">sha256:${escapeXml(shortHash)}</text>
  <line x1="64" y1="112" x2="1136" y2="112" stroke="#1E293B" stroke-width="1"/>

  <!-- Left column: Repo + Score + Verdict -->
  <text x="64" y="168" fill="#F8FAFC" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="700">${escapeXml(audit.repoSlug.slice(0, 32))}</text>
  <text x="64" y="200" fill="#94A3B8" font-family="ui-monospace, monospace" font-size="15">commit ${escapeXml(shortSha)}  ·  ${audit.slopHitCount} slop hits  ·  ${audit.fullReport.pass1.totalLoc.toLocaleString()} LOC</text>

  <!-- Score display -->
  <text x="64" y="330" fill="#F8FAFC" font-family="ui-monospace, monospace" font-size="112" font-weight="700">${audit.overallScore}</text>
  <text x="242" y="330" fill="#64748B" font-family="ui-monospace, monospace" font-size="34" font-weight="500">/100</text>
  <rect x="64" y="354" width="230" height="36" rx="6" fill="${tierColor}" fill-opacity="0.18" stroke="${tierColor}" stroke-width="1.2"/>
  <text x="179" y="378" text-anchor="middle" fill="#F8FAFC" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600">${escapeXml(audit.tier)}</text>

  <!-- Roast Verdict -->
  <text x="64" y="424" fill="#94A3B8" font-family="ui-monospace, monospace" font-size="13">ROAST VERDICT</text>
  ${verdictSvg}

  <!-- Divider -->
  <line x1="566" y1="146" x2="566" y2="556" stroke="#1E293B" stroke-width="1"/>

  <!-- Right column: 5-Pillar Breakdown -->
  <text x="610" y="168" fill="#F8FAFC" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600">5-Pillar Benchmark Breakdown</text>
  <text x="610" y="196" fill="#94A3B8" font-family="ui-monospace, monospace" font-size="13">Anchor: 50/100 MVP baseline · Deterministic weighting</text>
  ${barRows}

  <!-- Footer -->
  <line x1="64" y1="556" x2="1136" y2="556" stroke="#1E293B" stroke-width="1"/>
  <text x="64" y="582" fill="#64748B" font-family="ui-monospace, monospace" font-size="13">receipt /r/${escapeXml(audit.id)}</text>
  <text x="1136" y="582" text-anchor="end" fill="#64748B" font-family="ui-monospace, monospace" font-size="13">shipcheck.dev · Two-Pass Anti-Slop Benchmark</text>
</svg>`;
}
