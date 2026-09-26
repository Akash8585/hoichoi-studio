export const WORKFLOW_STEPS = [
  "Brief",
  "Generated",
  "Review",
  "Approved",
  "Scheduled",
  "Published",
  "Insights",
] as const;

export function workflowStep(
  packages: Array<{
    status: string;
    posts?: Array<{ status: string; metrics?: unknown[] }>;
  }>
) {
  if (!packages.length) return 0;
  const posts = packages.flatMap((pkg) => pkg.posts || []);
  if (posts.some((post) => post.status === "published" && (post.metrics?.length || 0) > 0)) {
    return WORKFLOW_STEPS.length;
  }
  if (posts.some((post) => post.status === "published")) return 5;
  if (posts.some((post) => post.status === "scheduled")) return 4;
  if (packages.every((pkg) => pkg.status === "approved")) return 3;
  if (packages.some((pkg) => pkg.status === "pending_approval")) return 2;
  return 1;
}

export function workflowLabel(step: number) {
  if (step >= WORKFLOW_STEPS.length) return WORKFLOW_STEPS[WORKFLOW_STEPS.length - 1];
  return WORKFLOW_STEPS[step] || WORKFLOW_STEPS[0];
}
