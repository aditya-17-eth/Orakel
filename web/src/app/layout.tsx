import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { WalletProvider } from "@/components/WalletProvider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orakel",
  description: "Prediction markets on Stellar.",
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
