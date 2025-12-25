import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polish | Autonomous Code Quality",
  description: "AI-powered autonomous code improvement. Polish continuously monitors, analyzes, and enhances your codebase quality.",
  keywords: ["code quality", "AI", "automation", "linting", "code review", "autonomous"],
  openGraph: {
    title: "Polish | Autonomous Code Quality",
    description: "AI-powered autonomous code improvement",
    url: "https://polish.run",
    siteName: "Polish",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Polish | Autonomous Code Quality",
    description: "AI-powered autonomous code improvement",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-mono bg-black text-green-400 antialiased" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        <div className="bg-grid scanlines vignette min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
