import type { Metadata, Viewport } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SwrProvider } from "@/components/providers/swr-provider";
import { CookieNotice } from "@/components/legal/cookie-notice";

export const metadata: Metadata = {
  title: "JoMaster – Software für Handwerksbetriebe",
  description:
    "Online-Terminbuchung, Disposition, Monteur-App und Büro-Dashboard für KMU-Handwerksbetriebe",
  applicationName: "JoMaster",
  manifest: "/manifest.json",
  // Explizite Favicons – Safari bevorzugt /favicon.ico; ohne gültige Datei erscheint
  // auf Vercel sonst das Standard-Dreieck.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0d5c63",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={cn("h-full", "antialiased", "font-sans")}
    >
      <body className="min-h-full flex flex-col font-sans">
        <SwrProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-right" richColors closeButton />
          <CookieNotice />
        </SwrProvider>
      </body>
    </html>
  );
}
