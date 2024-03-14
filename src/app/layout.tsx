import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mew",
  description: "For trees and things",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
