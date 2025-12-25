import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polish | Autonomous Code Quality",
  description: "AI-powered autonomous code improvement. Polish runs LLMs for hours to guarantee production-ready code. Ship when metrics say 95%+, not when it feels good enough.",
  keywords: ["code quality", "AI", "automation", "linting", "code review", "autonomous", "LLM"],
  openGraph: {
    title: "Polish | Autonomous Code Quality",
    description: "AI-generated code is fast, but not done. Polish iterates until metrics say 95%+.",
    url: "https://polish.run",
    siteName: "Polish",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Polish | Autonomous Code Quality",
    description: "AI-generated code is fast, but not done. Polish iterates until metrics say 95%+.",
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
      <body
        className="antialiased bg-grid"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {children}
      </body>
    </html>
  );
}
