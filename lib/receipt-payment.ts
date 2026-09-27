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

/** The designated email is the only account that receives Kha's payment details. */
export function getReceiptPayment(record: Record<string, unknown>): ReceiptPayment {
  return String(record.username ?? "").trim().toLowerCase() === "khadang2004cm@gmail.com"
    ? khaReceiptPayment
    : localReceiptPayment;
}
