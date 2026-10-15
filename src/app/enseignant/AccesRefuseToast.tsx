"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/lib/swal";

export default function AccesRefuseToast() {
  const router = useRouter();
  const affiche = useRef(false);

  useEffect(() => {
    if (affiche.current) return;
    affiche.current = true;
    void Toast.fire({ icon: "error", title: "Accès non autorisé" });
    router.replace("/enseignant", { scroll: false });
  }, [router]);

  return null;
}
