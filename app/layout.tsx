import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DataRouter Sales Agent",
  description: "Agent sales IA pour Broadteam / DataRouter",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-bg text-white">{children}</body>
    </html>
  );
}
