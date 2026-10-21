"use client";

import { AppliquerPreferences } from "@/components/AppliquerPreferences";
import { PwaProvider } from "@/components/pwa/PwaProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PwaProvider>
      <AppliquerPreferences />
      {children}
    </PwaProvider>
  );
}
