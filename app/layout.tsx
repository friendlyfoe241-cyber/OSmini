import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "OSmini — The mini operating system for organizations",
    template: "%s · OSmini",
  },
  description:
    "People, projects, tasks, milestones, automations and AI-powered operational intelligence in one simple system.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
