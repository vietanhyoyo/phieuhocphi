import { formatCurrency, minutesLabel } from "./utils";

export interface ReceiptExportInput {
  monthLabel: string;
  studentName: string;
  parentName?: string;
  subjects: Array<{ name: string; lessonCount: number; totalDurationMinutes: number; totalFee: number }>;
  totalFee: number;
  lessonDates: string[];
  notes: string;
  qrCodeDataUrl: string;
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  });
  if (line) lines.push(line);
  return lines;
}

export function exportReceiptToPng(input: ReceiptExportInput, fileName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const logicalWidth = 960;
    const scale = 2;
    const subjectHeight = 88;
    const dateLabels = input.lessonDates.map((date) => { const [, month, day] = date.split("-"); return `${day}/${month}`; });
    let dateRows = 1;
    let dateRowWidth = 0;
    dateLabels.forEach((label) => {
      const badgeWidth = label.length * 8 + 20;
      if (dateRowWidth && dateRowWidth + badgeWidth > logicalWidth - 156) { dateRows += 1; dateRowWidth = 0; }
      dateRowWidth += badgeWidth + 8;
    });
    const logicalHeight = 930 + input.subjects.length * subjectHeight + Math.max(0, dateRows - 1) * 30;
    const canvas = document.createElement("canvas");
    canvas.width = logicalWidth * scale;
    canvas.height = logicalHeight * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas is not supported"));
      return;
    }
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    ctx.fillStyle = "#dff2f4";
    ctx.fillRect(0, 0, logicalWidth, 10);
    ctx.fillStyle = "#4f46e5";
    ctx.fillRect(0, 0, 310, 10);
    ctx.fillStyle = "#e6b057";
    ctx.fillRect(310, 0, 270, 10);
    ctx.fillStyle = "#71bfae";
    ctx.fillRect(580, 0, 380, 10);

    drawText(ctx, "✦", 72, 82, "700 38px Arial", "#4f46e5");
    drawText(ctx, "SỔ HỌC PHÍ", 122, 69, "700 27px Arial", "#4338ca");
    drawText(ctx, "TRỢ LÝ GIA SƯ", 124, 93, "700 13px Arial", "#95a9b0");
    drawText(ctx, "PHIẾU HỌC PHÍ", logicalWidth / 2, 170, "800 17px Arial", "#89a5ae", "center");
    drawText(ctx, input.monthLabel, logicalWidth / 2, 211, "700 37px Arial", "#4338ca", "center");

    ctx.fillStyle = "#f3fafb";
    roundedRect(ctx, 56, 248, logicalWidth - 112, 106, 16);
    drawText(ctx, "HỌC SINH", 83, 278, "800 13px Arial", "#7c9ba5");
    drawText(ctx, input.studentName, 83, 316, "700 27px Arial", "#31586a");
    if (input.parentName) drawText(ctx, `Phụ huynh: ${input.parentName}`, 83, 341, "400 15px Arial", "#88a1a9");

    ctx.setLineDash([6, 7]);
    ctx.strokeStyle = "#cfdfe3";
    ctx.beginPath();
    ctx.moveTo(56, 394);
    ctx.lineTo(logicalWidth - 56, 394);
    ctx.stroke();
    ctx.setLineDash([]);
    drawText(ctx, "NỘI DUNG HỌC", 56, 428, "800 13px Arial", "#9aabb1");
    drawText(ctx, "THÀNH TIỀN", logicalWidth - 56, 428, "800 13px Arial", "#9aabb1", "right");

    let y = 473;
    input.subjects.forEach((subject) => {
      ctx.strokeStyle = "#edf1f2";
      ctx.beginPath();
      ctx.moveTo(56, y - 27);
      ctx.lineTo(logicalWidth - 56, y - 27);
      ctx.stroke();
      drawText(ctx, subject.name, 56, y, "700 21px Arial", "#466778");
      const lessonCountLabel = `${subject.lessonCount} buổi`;
      const subjectWidth = ctx.measureText(subject.name).width;
      const badgeWidth = ctx.measureText(lessonCountLabel).width + 16;
      ctx.fillStyle = "#eef2ff";
      roundedRect(ctx, 56 + subjectWidth + 12, y - 21, badgeWidth, 25, 12);
      drawText(ctx, lessonCountLabel, 56 + subjectWidth + 20, y - 4, "700 12px Arial", "#4338ca");
      drawText(ctx, minutesLabel(subject.totalDurationMinutes), 56, y + 27, "400 15px Arial", "#92a5ab");
      drawText(ctx, formatCurrency(subject.totalFee).replace(" ₫", "đ"), logicalWidth - 56, y + 10, "700 19px Arial", "#466778", "right");
      y += subjectHeight;
    });

    const totalTop = y - 20;
    ctx.strokeStyle = "#4f46e5";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(56, totalTop);
    ctx.lineTo(logicalWidth - 56, totalTop);
    ctx.stroke();
    ctx.lineWidth = 1;
    drawText(ctx, "TỔNG CỘNG", 56, totalTop + 52, "800 15px Arial", "#4f7c8b");
    drawText(ctx, formatCurrency(input.totalFee).replace(" ₫", "đ"), logicalWidth - 56, totalTop + 56, "800 31px Arial", "#4338ca", "right");
    ctx.strokeStyle = "#e6eef0";
    ctx.beginPath();
    ctx.moveTo(56, totalTop + 79);
    ctx.lineTo(logicalWidth - 56, totalTop + 79);
    ctx.stroke();

    const datesTop = totalTop + 112;
    ctx.fillStyle = "#fbf7ec";
    const datesHeight = 46 + dateRows * 30;
    roundedRect(ctx, 56, datesTop, logicalWidth - 112, datesHeight, 14);
    drawText(ctx, "NGÀY ĐÃ HỌC", 78, datesTop + 28, "800 13px Arial", "#7c9ba5");
    let dateX = 78;
    let dateY = datesTop + 39;
    dateRowWidth = 0;
    dateLabels.forEach((label) => {
      const badgeWidth = ctx.measureText(label).width + 20;
      if (dateRowWidth && dateRowWidth + badgeWidth > logicalWidth - 156) { dateX = 78; dateY += 30; dateRowWidth = 0; }
      ctx.fillStyle = "#e9f7f5";
      roundedRect(ctx, dateX, dateY, badgeWidth, 24, 8);
      drawText(ctx, label, dateX + badgeWidth / 2, dateY + 16, "700 11px Arial", "#287d78", "center");
      dateX += badgeWidth + 8;
      dateRowWidth += badgeWidth + 8;
    });

    const noteTop = datesTop + datesHeight + 22;
    drawText(ctx, "NHẬN XÉT", logicalWidth / 2, noteTop, "800 13px Arial", "#7c9ba5", "center");
    ctx.fillStyle = "#fffdf3";
    roundedRect(ctx, 56, noteTop + 18, logicalWidth - 112, 78, 14);
    ctx.font = "400 14px Arial";
    const noteLines = wrapText(ctx, input.notes, logicalWidth - 160).slice(0, 3);
    noteLines.forEach((line, index) => drawText(ctx, line, 78, noteTop + 45 + index * 20, "400 14px Arial", "#5d5b50"));

    const qrTop = noteTop + 120;
    drawText(ctx, "MÃ QR PHIẾU HỌC PHÍ", logicalWidth / 2, qrTop, "800 13px Arial", "#7c9ba5", "center");
    ctx.strokeStyle = "#71bfae";
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(logicalWidth / 2 - 75, qrTop + 14, 150, 150);
    ctx.setLineDash([]);
    drawText(ctx, "Quét để xem thông tin phiếu", logicalWidth / 2, qrTop + 180, "400 11px Arial", "#92a5ab", "center");
    drawText(ctx, "Cảm ơn bạn đã đồng hành cùng lớp học ✦", logicalWidth / 2, logicalHeight - 42, "italic 15px Arial", "#6995a2", "center");
    drawText(ctx, "Được tạo từ Sổ học phí", logicalWidth / 2, logicalHeight - 18, "400 12px Arial", "#b0bdc1", "center");

    const finish = () => canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not create PNG"));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 500);
      resolve();
    }, "image/png");
    if (input.qrCodeDataUrl) {
      const qrImage = new Image();
      qrImage.onload = () => { ctx.drawImage(qrImage, logicalWidth / 2 - 65, qrTop + 25, 130, 130); finish(); };
      qrImage.onerror = finish;
      qrImage.src = input.qrCodeDataUrl;
    } else finish();
  });
}
