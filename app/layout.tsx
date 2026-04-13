import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Board Games Online",
  description: "Jogue Dominó e Jogo da Velha com seus amigos em tempo real",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: '#0f172a', color: '#f1f5f9' }}>{children}</body>
    </html>
  );
}
