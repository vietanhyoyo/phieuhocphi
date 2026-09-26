"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Download, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AppData, NoticeType } from "@/lib/types";
import { exportReceiptToPng } from "@/lib/receipt-export";
import { formatCurrency, getMonthlySummary, minutesLabel, monthLabel, slugify } from "@/lib/utils";

export function ReceiptPreview({ data, target, onClose, onNotice }: { data: AppData; target: { studentId: string; month: string }; onClose: () => void; onNotice: (message: string, type?: NoticeType) => void }) {
  const [isExporting, setIsExporting] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const summary = getMonthlySummary(data, target.month, target.studentId)[0];
  const student = data.students.find((item) => item.id === target.studentId);
  const exportPng = async () => {
    if (!summary || !student || !receiptRef.current || isExporting) return;
    setIsExporting(true);
    try {
      await exportReceiptToPng(receiptRef.current, `hoc-phi-${slugify(student.name)}-${target.month}.png`);
      onNotice("Đã xuất phiếu học phí dạng PNG.");
    } catch {
      onNotice("Không thể xuất ảnh lúc này. Vui lòng thử lại.", "error");
    } finally {
      setIsExporting(false);
    }
  };
  if (!summary || !student) return null;
  return <div className="receipt-screen">
    <div className="receipt-toolbar">
      <button className="icon-button" onClick={onClose} aria-label="Đóng phiếu học phí"><ArrowLeft size={20} /></button>
      <div><span className="eyebrow">XEM TRƯỚC</span><strong>Phiếu học phí</strong></div>
      <button className="primary-button small-button" onClick={exportPng} disabled={isExporting} aria-busy={isExporting}>{isExporting ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />} {isExporting ? "Đang xuất…" : "Xuất PNG"}</button>
    </div>
    <div className="receipt-scroll">
      <div ref={receiptRef} className="receipt-card">
        <div className="receipt-top-decoration"><span /><span /><span /></div>
        <div className="receipt-heading-row">
          <div className="receipt-brand"><span className="brand-mark brand-image"><img src="/app-logo.png" alt="Logo Sổ học phí" /></span><div><strong>SỔ HỌC PHÍ</strong><small>TRỢ LÝ GIA SƯ</small></div></div>
          <div className="receipt-title"><span>PHIẾU HỌC PHÍ</span><h2>{monthLabel(target.month)}</h2></div>
        </div>
        <div className="receipt-student"><div><span>HỌC SINH</span><strong>{student.name}</strong></div>{student.parentName && <small>Phụ huynh: {student.parentName}</small>}</div>
        <div className="receipt-lines">
          <div className="receipt-lines-header"><span>NỘI DUNG HỌC</span><span>THÀNH TIỀN</span></div>
          {summary.subjects.map((subject) => <div className="receipt-line" key={subject.subjectId}><div><div className="receipt-subject-heading"><strong>{subject.subjectName}</strong><Badge variant="secondary" className="receipt-count-badge">{subject.lessonCount} buổi</Badge></div><small>{minutesLabel(subject.totalDurationMinutes)}</small></div><strong>{formatCurrency(subject.totalFee).replace(" ₫", "đ")}</strong></div>)}
        </div>
        <div className="receipt-total"><span>TỔNG CỘNG</span><strong>{formatCurrency(summary.totalFee).replace(" ₫", "đ")}</strong></div>
        <div className="receipt-dates"><span>NGÀY ĐÃ HỌC</span><div className="receipt-date-badges">{summary.lessonDates.map((date) => { const [, month, day] = date.split("-"); return <Badge variant="secondary" key={date}>{day}/{month}</Badge>; })}</div></div>
        <div className="receipt-qr">
          <span className="receipt-qr-label">THANH TOÁN CHUYỂN KHOẢN</span>
          <img src="/payment-qr.jpg" alt="Mã QR chuyển khoản Techcombank" />
          <div className="receipt-payment-info"><strong>TECHCOMBANK</strong><small>DANH MINH HIEU</small><b>8804 0402 02</b><em>Quét mã để chuyển khoản</em></div>
        </div>
        <div className="receipt-footer"><span>Cảm ơn bạn đã đồng hành cùng lớp học ✦</span><small>Được tạo từ Sổ học phí</small></div>
      </div>
    </div>
  </div>;
}
