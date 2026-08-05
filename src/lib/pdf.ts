import type { BudgetWithItems, Company, ServiceOrderWithPhotos } from "@/lib/types";
import { formatCurrency, formatDate, publicServiceOrderPhotoUrl } from "@/lib/api";

export async function generateBudgetPdf(budget: BudgetWithItems, company: Company): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  const brand = hexToRgb(company.primary_color) || { r: 37, g: 101, b: 235 };
  doc.setFillColor(brand.r, brand.g, brand.b);
  doc.rect(0, 0, pageWidth, 28, "F");

  if (company.logo_url) {
    try {
      const imgData = await urlToBase64(company.logo_url);
      const fmt = company.logo_url.match(/\.(png)$/i) ? "PNG" : "JPEG";
      doc.addImage(imgData, fmt, margin, 6, 16, 16);
    } catch {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(company.name.charAt(0).toUpperCase(), margin + 4, 18);
    }
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(company.name.charAt(0).toUpperCase(), margin + 4, 18);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(company.name, margin + 20, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("ORÇAMENTO", margin + 20, 21);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(budget.title || "Orçamento", margin, 40);

  let y = 50;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(budget.client_name || "—", margin, y + 5);
  if (budget.client_email) doc.text(budget.client_email, margin, y + 10);
  if (budget.client_phone) doc.text(budget.client_phone, margin, y + 15);

  doc.setFont("helvetica", "bold");
  doc.text("VÁLIDO ATÉ", pageWidth - margin - 40, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(budget.valid_until), pageWidth - margin - 40, y + 5);
  doc.text(`Emitido em ${formatDate(budget.created_at)}`, pageWidth - margin - 40, y + 10);

  if (budget.description) {
    y += 22;
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIÇÃO", margin, y);
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(budget.description, pageWidth - margin * 2);
    doc.text(descLines, margin, y + 5);
    y += 5 + descLines.length * 4 + 4;
  } else {
    y += 22;
  }

  const itemsTotal = budget.items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price), 0);
  const laborCost = Number(budget.labor_cost) || 0;
  const total = itemsTotal + laborCost;

  autoTable(doc, {
    startY: y,
    head: [["#", "Descrição", "Qtd", "Un.", "Valor Unit.", "Subtotal"]],
    body: budget.items.map((it, idx) => [
      String(idx + 1),
      it.description,
      String(it.quantity),
      it.unit || "un",
      formatCurrency(Number(it.unit_price)),
      formatCurrency(Number(it.quantity) * Number(it.unit_price)),
    ]),
    theme: "striped",
    headStyles: { fillColor: [brand.r, brand.g, brand.b], fontSize: 9, halign: "center" },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      2: { halign: "center", cellWidth: 16 },
      3: { halign: "center", cellWidth: 14 },
      4: { halign: "right", cellWidth: 28 },
      5: { halign: "right", cellWidth: 30 },
    },
    margin: { left: margin, right: margin },
  });

  // @ts-ignore lastAutoTable is added by the plugin
  let afterItemsY = (doc as any).lastAutoTable?.finalY || y + 20;
  if (laborCost > 0) {
    afterItemsY += 2;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("MÃO DE OBRA", margin, afterItemsY);
    doc.setFont("helvetica", "normal");
    doc.text(formatCurrency(laborCost), pageWidth - margin, afterItemsY, { align: "right" });
    afterItemsY += 6;
  }

  const finalY = afterItemsY;
  doc.setFillColor(brand.r, brand.g, brand.b);
  doc.rect(pageWidth - margin - 70, finalY + 4, 70, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", pageWidth - margin - 66, finalY + 11);
  doc.text(formatCurrency(total), pageWidth - margin - 6, finalY + 11, { align: "right" });

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${company.name} · Orçamento gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    margin,
    doc.internal.pageSize.getHeight() - 10,
  );

  const safeName = (budget.title || "orcamento").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();

  // Use blob + object URL so downloads work inside webviews/sandboxed iframes
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.pdf`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

export async function generateServiceOrderPdf(
  os: ServiceOrderWithPhotos,
  company: Company,
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const brand = hexToRgb(company.primary_color) || { r: 37, g: 101, b: 235 };

  // Header band
  doc.setFillColor(brand.r, brand.g, brand.b);
  doc.rect(0, 0, pageWidth, 28, "F");

  if (company.logo_url) {
    try {
      const imgData = await urlToBase64(company.logo_url);
      const fmt = company.logo_url.match(/\.(png)$/i) ? "PNG" : "JPEG";
      doc.addImage(imgData, fmt, margin, 6, 16, 16);
    } catch {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(company.name.charAt(0).toUpperCase(), margin + 4, 18);
    }
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(company.name.charAt(0).toUpperCase(), margin + 4, 18);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(company.name, margin + 20, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("ORDEM DE SERVIÇO", margin + 20, 21);

  // Title
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(os.title || "Ordem de Serviço", margin, 40);

  let y = 50;

  // Client + technician block
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(os.client_name || "—", margin, y + 5);
  if (os.client_email) doc.text(os.client_email, margin, y + 10);
  if (os.client_phone) doc.text(os.client_phone, margin, y + 15);

  doc.setFont("helvetica", "bold");
  doc.text("TÉCNICO RESPONSÁVEL", pageWidth - margin - 50, y);
  doc.setFont("helvetica", "normal");
  doc.text(os.technician || "—", pageWidth - margin - 50, y + 5);

  doc.setFont("helvetica", "bold");
  doc.text("EMITIDO EM", pageWidth - margin - 50, y + 10);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(os.created_at), pageWidth - margin - 50, y + 15);

  y += 22;

  // Service to execute
  if (os.service_to_execute) {
    doc.setFont("helvetica", "bold");
    doc.text("SERVIÇO A EXECUTAR", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(os.service_to_execute, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 6;
  }

  // Materials used (from budget)
  if (os.materials_used && os.materials_used.length) {
    if (y > pageHeight - 60) { doc.addPage(); y = 20; }
    autoTable(doc, {
      startY: y,
      head: [["MATERIAIS UTILIZADOS"]],
      body: os.materials_used.map((m) => [m]),
      theme: "striped",
      headStyles: { fillColor: [brand.r, brand.g, brand.b], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: margin, right: margin },
    });
    // @ts-ignore lastAutoTable
    y = (doc as any).lastAutoTable?.finalY + 8 || y + 20;
  }

  // Complementary materials (added during execution)
  const complementary = os.items || [];
  if (complementary.length) {
    if (y > pageHeight - 60) { doc.addPage(); y = 20; }
    autoTable(doc, {
      startY: y,
      head: [["MATERIAIS COMPLEMENTARES", "Qtd", "Un."]],
      body: complementary.map((it) => [
        it.description,
        String(it.quantity),
        it.unit || "un",
      ]),
      theme: "striped",
      headStyles: { fillColor: [brand.r, brand.g, brand.b], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        1: { halign: "center", cellWidth: 16 },
        2: { halign: "center", cellWidth: 14 },
      },
      margin: { left: margin, right: margin },
    });
    // @ts-ignore lastAutoTable
    y = (doc as any).lastAutoTable?.finalY + 8 || y + 20;
  }

  // Notes
  if (os.notes) {
    if (y > pageHeight - 40) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVAÇÕES", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(os.notes, contentWidth);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4 + 8;
  }

  // Photos section
  const beforePhotos = (os.photos || []).filter((p) => p.kind === "before");
  const afterPhotos = (os.photos || []).filter((p) => p.kind === "after");

  if (beforePhotos.length || afterPhotos.length) {
    if (y > pageHeight - 60) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("REGISTRO FOTOGRÁFICO", margin, y);
    y += 6;
    doc.setFontSize(9);
  }

  const drawPhotoGroup = async (label: string, paths: string[], startY: number) => {
    let cy = startY;
    if (!paths.length) return cy;
    if (cy > pageHeight - 40) { doc.addPage(); cy = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), margin, cy);
    cy += 4;

    const thumbW = 55;
    const thumbH = 40;
    const gapX = 8;
    const gapY = 6;
    let col = 0;
    for (const p of paths) {
      if (col >= 3) { col = 0; cy += thumbH + gapY; }
      if (cy + thumbH > pageHeight - 15) { doc.addPage(); cy = 20; col = 0; }
      const x = margin + col * (thumbW + gapX);
      try {
        const imgData = await urlToBase64(publicServiceOrderPhotoUrl(p));
        doc.addImage(imgData, "JPEG", x, cy, thumbW, thumbH, undefined, "FAST");
      } catch {
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(x, cy, thumbW, thumbH, 2, 2, "FD");
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(8);
        doc.text("foto", x + thumbW / 2 - 4, cy + thumbH / 2);
      }
      doc.setDrawColor(220, 220, 220);
      doc.rect(x, cy, thumbW, thumbH);
      col++;
    }
    return cy + thumbH + gapY + 4;
  };

  y = await drawPhotoGroup("ANTES (antes do serviço)", beforePhotos.map((p) => p.storage_path), y);
  y = await drawPhotoGroup("DEPOIS (serviço realizado)", afterPhotos.map((p) => p.storage_path), y);

  // Footer
  const footerY = pageHeight - 10;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${company.name} · Ordem de serviço gerada em ${new Date().toLocaleDateString("pt-BR")}`,
    margin,
    footerY,
  );

  // Signature lines
  const signY = Math.min(y, pageHeight - 30);
  doc.setDrawColor(120, 120, 120);
  doc.line(margin, signY, margin + 70, signY);
  doc.line(pageWidth - margin - 70, signY, pageWidth - margin, signY);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Executado por", margin, signY + 4);
  doc.text("Conferido por", pageWidth - margin - 70, signY + 4);

  const safeName = (os.title || "ordem-de-servico").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.pdf`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
