import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";
import { ErrorSuppress } from "./error-suppress";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Dream Journal - Encrypted Dream Journal",
  description: "Privacy-preserving dream journal using FHE encryption",
  icons: {
    icon: "/logo.svg", // Use logo.svg as icon
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`dream-bg text-foreground antialiased`}>
        <Script
          src="/suppress-fetch-error.js"
          strategy="beforeInteractive"
        />
        <div className="fixed inset-0 w-full h-full dream-bg z-[-20] min-w-[850px]"></div>
        <main className="flex flex-col max-w-screen-lg mx-auto pb-20 min-w-[850px]">
          <nav className="flex w-full px-3 md:px-0 h-fit py-10 justify-between items-center">
            <div className="flex items-center gap-4">
              <Image
                src="/logo.svg"
                alt="Dream Journal Logo"
                width={120}
                height={120}
                className="rounded-full"
                priority
                unoptimized
              />
              <h1 className="text-3xl font-bold text-white">Dream Journal</h1>
            </div>
          </nav>
          <ErrorSuppress />
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}

