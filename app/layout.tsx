import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignalFoundry · Autonomous AI Creator",
  description:
    "A durable autonomous editorial intelligence system that discovers, judges, remembers, and publishes AI and technology analysis.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
