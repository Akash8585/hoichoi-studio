import { humanQualityPassed } from "@/lib/ai/quality";

export type PackageStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "discarded";

const allowed: Record<PackageStatus, PackageStatus[]> = {
  draft: ["pending_approval", "discarded"],
  pending_approval: ["approved", "discarded", "draft"],
  approved: ["discarded"],
  discarded: ["draft"],
};

export function canTransition(from: string, to: PackageStatus): boolean {
  const current = from as PackageStatus;
  return allowed[current]?.includes(to) ?? false;
}

export function assertTransition(from: string, to: PackageStatus) {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal status transition: ${from} → ${to}`);
  }
}

export function imageAssetsReady(pkg: {
  imageStatus: string;
  imageProvider?: string | null;
  qualityChecks?: string | null;
}): boolean {
  let qualityPassed = false;
  try {
    qualityPassed = humanQualityPassed(
      JSON.parse(pkg.qualityChecks || "{}") as Record<string, unknown>
    );
  } catch {
    qualityPassed = false;
  }
  return (
    pkg.imageStatus === "ready" &&
    pkg.imageProvider !== "svg_fallback" &&
    qualityPassed
  );
}
