import type { Metadata } from "next";
// @ts-ignore: CSS module declarations may be missing in this setup
import "./globals.css";

export const metadata: Metadata = {
  title: "STAR Camp Registration",
  description: "Register for STAR Camp Abuja and Owerri 2026.",
  manifest: "/manifest.json",
  themeColor: "#6d28d9",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "STAR Camp"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
