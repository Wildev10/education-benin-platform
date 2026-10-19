"use client";

import { SessionProvider } from "next-auth/react";
import { PwaProvider } from "@/components/pwa/PwaProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PwaProvider>{children}</PwaProvider>
    </SessionProvider>
  );
}