import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sổ học phí | Trợ lý gia sư",
  description: "Quản lý buổi dạy và học phí đơn giản, riêng tư, lưu ngay trên thiết bị.",
  icons: {
    icon: "/app-logo.png",
    apple: "/app-logo.png",
  },
};

// maximum-scale=1 stops iOS Safari/Chrome from auto-zooming when an input under 16px gets focus.
// iOS still lets users pinch-zoom manually.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
