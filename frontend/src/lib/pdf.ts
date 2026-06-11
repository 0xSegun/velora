import type { Report } from "@/types/report";
import { formatDate, formatDateTime } from "@/lib/dates";
import { PRINT_DOCUMENT_TITLE } from "@/lib/print";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = PAGE_HEIGHT - 36;

type PdfDoc = InstanceType<Awaited<typeof import("jspdf")>["jsPDF"]>;

function addPageFooter(doc: PdfDoc, pageNum: number, totalPages: number) {
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${PRINT_DOCUMENT_TITLE} · Generated ${formatDateTime(new Date())}`,
    MARGIN,
    FOOTER_Y,
  );
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_WIDTH - MARGIN, FOOTER_Y, {
    align: "right",
  });
}

function ensureSpace(doc: PdfDoc, y: number, needed: number): number {
  if (y + needed > FOOTER_Y - 24) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

export async function downloadReportPdf(report: Report) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = MARGIN;

  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, PAGE_WIDTH, 108, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text(`${PRINT_DOCUMENT_TITLE} Economic Report`, MARGIN, 52);
  doc.setFontSize(11);
  doc.text(report.title, MARGIN, 78);

  doc.setTextColor(0, 0, 0);
  y = 138;
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Type: ${report.report_type}`, MARGIN, y);
  y += 16;
  doc.text(`Source: ${report.source}`, MARGIN, y);
  y += 16;
  doc.text(`Published: ${formatDate(report.published_at)}`, MARGIN, y);
  y += 16;
  doc.text(`Generated: ${formatDateTime(report.created_at)}`, MARGIN, y);
  y += 28;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text("Executive Summary", MARGIN, y);
  y += 20;
  doc.setFontSize(11);
  doc.setTextColor(51, 51, 51);
  const summary = doc.splitTextToSize(report.summary || "No summary provided.", CONTENT_WIDTH);
  y = ensureSpace(doc, y, summary.length * 14 + 8);
  doc.text(summary, MARGIN, y);
  y += summary.length * 14 + 20;

  const sections = (report.content?.sections as Array<{ title: string; body: string }>) ?? [];
  if (sections.length === 0 && report.content?.body) {
    sections.push({ title: "Report Content", body: String(report.content.body) });
  }

  for (const section of sections) {
    y = ensureSpace(doc, y, 40);
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text(section.title, MARGIN, y);
    y += 18;
    doc.setFontSize(11);
    doc.setTextColor(51, 51, 51);
    const body = doc.splitTextToSize(section.body, CONTENT_WIDTH);
    y = ensureSpace(doc, y, body.length * 14 + 8);
    doc.text(body, MARGIN, y);
    y += body.length * 14 + 16;
  }

  const references =
    (report.content?.references as string[]) ??
    (report.metadata_extra?.references as string[]) ??
    [];
  if (references.length > 0) {
    y = ensureSpace(doc, y, 40);
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text("References", MARGIN, y);
    y += 18;
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);
    references.forEach((ref, index) => {
      const line = doc.splitTextToSize(`${index + 1}. ${ref}`, CONTENT_WIDTH);
      y = ensureSpace(doc, y, line.length * 12 + 8);
      doc.text(line, MARGIN, y);
      y += line.length * 12 + 8;
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    addPageFooter(doc, page, totalPages);
  }

  doc.save(`${report.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}