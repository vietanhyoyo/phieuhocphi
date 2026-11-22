export type ReceiptPayment = {
  qrSrc: string;
  bank: string;
  accountName: string;
  accountNumber: string;
};

export const localReceiptPayment: ReceiptPayment = {
  qrSrc: "/danh-minh-hieu-qr.png",
  bank: "TECHCOMBANK",
  accountName: "DANH MINH HIEU",
  accountNumber: "8804 0402 02",
};

const khaReceiptPayment: ReceiptPayment = {
  qrSrc: "/dang-vu-kha-qr.png",
  bank: "MB BANK",
  accountName: "DANG VU KHA",
  accountNumber: "20402023979",
};

const trungReceiptPayment: ReceiptPayment = {
  qrSrc: "/tran-quoc-trung-qr.jpg",
  bank: "VIETCOMBANK",
  accountName: "TRAN QUOC TRUNG",
  accountNumber: "1032705912",
};

/** Accounts with their own payment details; everyone else uses the default. */
const paymentsByUsername: Record<string, ReceiptPayment> = {
  "khadang2004cm@gmail.com": khaReceiptPayment,
  "quốc trung": trungReceiptPayment,
};

export function getReceiptPayment(record: Record<string, unknown>): ReceiptPayment {
  return paymentsByUsername[String(record.username ?? "").trim().toLowerCase().normalize("NFC")] ?? localReceiptPayment;
}
