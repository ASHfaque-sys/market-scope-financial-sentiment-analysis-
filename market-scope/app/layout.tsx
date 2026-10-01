import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarketScope | Indian financial sentiment",
  description: "Explore Indian stocks, recent financial news and an independently evaluated headline sentiment model.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
