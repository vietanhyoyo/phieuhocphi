import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sổ học phí | Trợ lý gia sư",
  description: "Quản lý buổi dạy và học phí đơn giản, riêng tư, lưu ngay trên thiết bị.",
  icons: {
    icon: "/app-logo.png",
    apple: "/app-logo.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
