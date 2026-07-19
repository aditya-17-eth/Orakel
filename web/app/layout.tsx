import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { WalletProvider } from "@/components/WalletProvider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://web-one-indol-57.vercel.app"),
  title: { default: "Orakel", template: "%s | Orakel" },
  description: "Trade testnet prediction markets and manage collateral-backed positions on Stellar Soroban.",
  openGraph: { title: "Orakel Prediction Markets", description: "Prediction markets on Stellar Soroban.", type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <WalletProvider>
          <Navbar />
          <main>{children}</main>
          <Toaster />
        </WalletProvider>
      </body>
    </html>
  );
}
