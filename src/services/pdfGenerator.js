// services/pdfGenerator.js
// Minimal, dependency-free PDF writer for simple text documents (receipts,
// invoices). No external library and no CDN — hand-rolls just enough PDF
// syntax to render left-aligned lines of text on one or more A4 pages,
// which keeps the app fully offline as required. Callers supply plain
// text lines (see domain/payments/ledgerService.js); this module only
// knows how to turn text into PDF bytes.

const PAGE_WIDTH = 595; // A4, points
const PAGE_HEIGHT = 842;
const MARGIN = 56;
const LINE_HEIGHT = 16;
const FONT_SIZE = 11;
const TITLE_FONT_SIZE = 16;
const TITLE_GAP = 14;

/**
 * @param {{ title?: string, lines?: string[] }} doc
 * @returns {Blob} application/pdf blob
 */
export function generatePdf({ title = '', lines = [] } = {}) {
  const titleHeight = title ? TITLE_FONT_SIZE + TITLE_GAP : 0;
  const usableHeight = PAGE_HEIGHT - MARGIN * 2 - titleHeight;
  const linesPerPage = Math.max(1, Math.floor(usableHeight / LINE_HEIGHT));

  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([]);

  const pageCount = pages.length;
  const pagesObjNum = 2;
  const fontObjNum = 3;
  const firstPageObjNum = 4;
  const firstContentObjNum = firstPageObjNum + pageCount;

  const objects = [];
  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>\nendobj`;

  const kids = Array.from({ length: pageCount }, (_, i) => `${firstPageObjNum + i} 0 R`).join(' ');
  objects[pagesObjNum] = `${pagesObjNum} 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj`;

  objects[fontObjNum] = `${fontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`;

  pages.forEach((pageLines, index) => {
    const pageObjNum = firstPageObjNum + index;
    const contentObjNum = firstContentObjNum + index;

    objects[pageObjNum] =
      `${pageObjNum} 0 obj\n` +
      `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj`;

    const contentStream = buildPageContent(index === 0 ? title : '', pageLines, index === 0);
    objects[contentObjNum] =
      `${contentObjNum} 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj`;
  });

  return assemblePdf(objects);
}

function buildPageContent(title, pageLines, isFirstPage) {
  let y = PAGE_HEIGHT - MARGIN;
  const parts = ['BT'];

  if (isFirstPage && title) {
    parts.push(`/F1 ${TITLE_FONT_SIZE} Tf`);
    parts.push(`1 0 0 1 ${MARGIN} ${y} Tm`);
    parts.push(`(${escapePdfText(title)}) Tj`);
    y -= TITLE_FONT_SIZE + TITLE_GAP;
  }

  parts.push(`/F1 ${FONT_SIZE} Tf`);
  pageLines.forEach((line) => {
    parts.push(`1 0 0 1 ${MARGIN} ${y} Tm`);
    parts.push(`(${escapePdfText(line)}) Tj`);
    y -= LINE_HEIGHT;
  });

  parts.push('ET');
  return parts.join('\n');
}

// Base-14 Helvetica only reliably covers ASCII. Non-ASCII characters are
// also rejected here for a stricter reason than font coverage: /Length
// below is computed as a JS string length (UTF-16 code units), but the
// final Blob is UTF-8 encoded — any multi-byte character would make the
// declared stream length shorter than its actual byte length and corrupt
// the file. Replacing with '?' keeps string length === byte length.
function escapePdfText(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '?');
}

function assemblePdf(objects) {
  let body = '%PDF-1.4\n';
  const offsets = [0];

  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = body.length;
    body += objects[i] + '\n';
  }

  const xrefStart = body.length;
  const objectCount = objects.length;

  let xref = `xref\n0 ${objectCount}\n0000000000 65535 f \n`;
  for (let i = 1; i < objectCount; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([body + xref + trailer], { type: 'application/pdf' });
}
