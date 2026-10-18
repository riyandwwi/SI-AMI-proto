import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SI-AMI ITBMP",
  description: "Sistem Audit Mutu Internal Kampus ITBMP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
