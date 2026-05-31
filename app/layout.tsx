import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STAR Camp Registration",
  description: "Register for STAR Camp Abuja or Owerri 2026"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
