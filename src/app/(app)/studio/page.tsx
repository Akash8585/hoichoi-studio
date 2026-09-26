import { Suspense } from "react";
import StudioPage from "./StudioClient";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading studio…</p>}>
      <StudioPage />
    </Suspense>
  );
}
