import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WORKFLOW_STEPS } from "@/lib/domain/workflow";
export { workflowStep, workflowLabel } from "@/lib/domain/workflow";

export function PipelineStepper({
  current,
  compact = false,
}: {
  current: number;
  compact?: boolean;
}) {
  return (
    <ol className="flex w-full items-center" aria-label="Campaign progress">
      {WORKFLOW_STEPS.map((step, index) => {
        const complete = index < current;
        const active = index === current;
        return (
          <li key={step} className="flex min-w-0 flex-1 items-start last:flex-none">
            <div className="flex min-w-0 flex-col items-center gap-1.5">
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full border text-[11px] transition",
                  complete && "border-white bg-white text-black",
                  active && "border-[#0099ff] bg-[#0099ff]/10 text-[#0099ff]",
                  !complete && !active && "border-[#262626] bg-[#141414] text-zinc-600"
                )}
                aria-current={active ? "step" : undefined}
              >
                {complete ? <Check className="size-3.5" aria-hidden /> : index + 1}
              </span>
              {!compact && (
                <span className={cn("hidden text-[11px] lg:block", active ? "text-white" : "text-zinc-600")}>
                  {step}
                </span>
              )}
            </div>
            {index < WORKFLOW_STEPS.length - 1 && (
              <span
                className={cn(
                  "mx-2 mt-[13.5px] h-px min-w-3 flex-1",
                  index < current ? "bg-white" : "bg-[#262626]"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

