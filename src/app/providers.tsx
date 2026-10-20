"use client";

import { PwaProvider } from "@/components/pwa/PwaProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <PwaProvider>{children}</PwaProvider>;
}
