import type { Metadata } from "next";
import "./globals.css";
import Grain from "./components/Grain";

export const metadata: Metadata = {
  title: "Infinite Crafting RPG",
  description: "Fight, loot, and combine any two items to craft new ones, forever.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Grain />
        {children}
      </body>
    </html>
  );
}
