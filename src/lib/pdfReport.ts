import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  PILLAR_META,
  PILLAR_WEIGHTS,
  type AuditRecord,
  type PillarKey,
} from '../../packages/core/src/index.ts';

const ORDERED_PILLARS: PillarKey[] = [
  'functionality',
  'usefulness',
  'anti_slop',
  'creativity',
  'marketability',
];

function sanitizeFilename(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

/**
 * Captures the rendered audit summary and 5-pillar radar chart via html2canvas-pro
 * and produces a multi-page A4 offline PDF report with cited pillar evidence.
 */
export async function exportAuditReceiptPdf(
  audit: AuditRecord,
  captureElement: HTMLElement
): Promise<string> {
  const canvas = await html2canvas(captureElement, {
    scale: 2,
    backgroundColor: '#F8FAFC',
    useCORS: true,
    logging: false,
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Page 1 Header
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageWidth, 26, 'F');

  pdf.setTextColor(248, 250, 252);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('ShipCheck — Verifiable Audit Report', margin, 11);

  pdf.setFont('courier', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text(
    `${audit.repoSlug}  |  commit ${audit.commitSha.slice(0, 7)}  |  sha256:${audit.bundleHash.slice(0, 16)}`,
    margin,
    18
  );

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(248, 250, 252);
  pdf.text(
    `${audit.overallScore}/100 (${audit.tier})`,
    pageWidth - margin,
    11,
    { align: 'right' }
  );

  pdf.setFont('courier', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(148, 163, 184);
  pdf.text(
    `Exported ${new Date().toISOString().slice(0, 10)}`,
    pageWidth - margin,
    18,
    { align: 'right' }
  );

  // Embed captured summary + radar chart canvas
  const imgData = canvas.toDataURL('image/png');
  const maxImgHeight = pageHeight - 44;
  let renderWidth = contentWidth;
  let renderHeight = (canvas.height * renderWidth) / canvas.width;

  if (renderHeight > maxImgHeight) {
    renderHeight = maxImgHeight;
    renderWidth = (canvas.width * renderHeight) / canvas.height;
  }

  const offsetX = margin + (contentWidth - renderWidth) / 2;
  pdf.addImage(imgData, 'PNG', offsetX, 32, renderWidth, renderHeight, undefined, 'FAST');

  // Footer on Page 1
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Receipt ID: /r/${audit.id}`, margin, pageHeight - 8);
  pdf.text('Page 1 of 2', pageWidth - margin, pageHeight - 8, { align: 'right' });

  // Page 2: Vector-text Cited Pillar Evidence Breakdown for offline search & archival
  pdf.addPage();
  let cursorY = 18;

  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('Pass 2 Cited Pillar Evidence', margin, cursorY);
  cursorY += 6;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text(
    `Judge: ${audit.fullReport.judgeModel}  ·  Anchor: 50/100 working MVP baseline  ·  Deterministic weighting`,
    margin,
    cursorY
  );
  cursorY += 8;

  for (const key of ORDERED_PILLARS) {
    const meta = PILLAR_META[key];
    const evidence = audit.fullReport.pass2.pillars[key];
    const weightedPts = (evidence.score * PILLAR_WEIGHTS[key]).toFixed(1);

    if (cursorY > pageHeight - 44) {
      pdf.addPage();
      cursorY = 18;
    }

    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 5;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(`${meta.label} (${meta.weightPct}%)`, margin, cursorY);

    pdf.setFont('courier', 'bold');
    pdf.text(
      `${evidence.score}/100  (+${weightedPts} pts)`,
      pageWidth - margin,
      cursorY,
      { align: 'right' }
    );
    cursorY += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(51, 65, 85);
    const summaryLines = pdf.splitTextToSize(evidence.summary, contentWidth) as string[];
    pdf.text(summaryLines, margin, cursorY);
    cursorY += summaryLines.length * 4 + 2;

    for (const s of evidence.strengths) {
      const lines = pdf.splitTextToSize(`+ ${s}`, contentWidth - 4) as string[];
      pdf.setTextColor(21, 128, 61);
      pdf.text(lines, margin + 2, cursorY);
      cursorY += lines.length * 3.8 + 1;
    }

    for (const d of evidence.deductions) {
      const lines = pdf.splitTextToSize(`- ${d}`, contentWidth - 4) as string[];
      pdf.setTextColor(185, 28, 28);
      pdf.text(lines, margin + 2, cursorY);
      cursorY += lines.length * 3.8 + 1;
    }

    cursorY += 3;
  }

  // Footer on final page
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Bundle SHA-256: ${audit.bundleHash}`, margin, pageHeight - 8);
  pdf.text(`Page ${pdf.getNumberOfPages()}`, pageWidth - margin, pageHeight - 8, {
    align: 'right',
  });

  const filename = `shipcheck-${sanitizeFilename(audit.repoSlug)}-${audit.commitSha.slice(0, 7)}.pdf`;
  pdf.save(filename);
  return filename;
}
