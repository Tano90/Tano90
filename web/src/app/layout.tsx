import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kitchen Ledger",
  description: "Rezepte, Kalkulation, Einkauf und Lager für Gastronomie-Betriebe.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
