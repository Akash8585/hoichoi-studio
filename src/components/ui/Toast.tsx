"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="top-right" closeButton richColors />
    </>
  );
}

export function useToast() {
  return {
    show(
      message: string,
      tone: "success" | "error" | "info" | "warning" = "info"
    ) {
      if (tone === "success") return toast.success(message);
      if (tone === "error") return toast.error(message);
      if (tone === "warning") return toast.warning(message);
      return toast.info(message);
    },
  };
}

