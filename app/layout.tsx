import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Production Automation",
  description:
    "Convert a completed video script into storyboard, image prompts, video prompts, and voiceover direction.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
