import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ontwerp logboek",
  description: "Issues, afwijkingen, wijzigingen, ontwerpkeuzes en raakvlakafspraken per object vastleggen.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
