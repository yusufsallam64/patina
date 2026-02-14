import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Patina",
  description: "Your creative taste, made actionable.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-[#0a0a0c] text-[#e8e8ec] overflow-hidden">
        {children}
      </body>
    </html>
  );
}
