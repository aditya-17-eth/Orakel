import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { WalletProvider } from "@/providers/wallet-provider";

export const metadata: Metadata = {
  title: "Orakel — Stellar Prediction Markets",
  description: "Collateralized prediction markets and market-backed lending on Stellar Testnet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <WalletProvider>
          <Navbar />
          <main className="flex-1 pt-16">{children}</main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
