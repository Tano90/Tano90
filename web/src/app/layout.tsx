import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toast";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  // Absolute links for the share preview (og:image); APP_URL is the public address.
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { template: `%s · ${APP_NAME}`, default: APP_NAME },
  description: APP_TAGLINE,
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
