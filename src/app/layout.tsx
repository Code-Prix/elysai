import "~/styles/globals.css";
// Force rebuild

import { Geist } from "next/font/google";
import { type Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";
import { Sidebar } from "./_components/Sidebar";
import { auth } from "@/../auth";

export const metadata: Metadata = {
  title: "ElysAI",
  description: "Your AI Therapy Companion",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="bg-[#343541] text-[#ECECF1]">
        <TRPCReactProvider>
          <div className="flex min-h-screen">
            {session && <Sidebar />}
            <main className="flex-1">
              {children}
            </main>
          </div>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
