import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polish | Virtual Engineers for Your Team",
  description: "Scale your dev team with virtual engineers that write production-quality code. No more vibe coding nightmares - maintainable, tested code at a fraction of the cost.",
  keywords: ["code quality", "AI", "automation", "virtual engineers", "team scaling", "LLM", "production code"],
  openGraph: {
    title: "Polish | Virtual Engineers for Your Team",
    description: "Vibe coding is fast. Maintaining it is hell. Polish gives you virtual engineers that write code your team can actually maintain.",
    url: "https://polish.run",
    siteName: "Polish",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Polish | Virtual Engineers for Your Team",
    description: "Vibe coding is fast. Maintaining it is hell. Polish gives you virtual engineers that write code your team can actually maintain.",
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
