import { Clapperboard, Clock3, Lock, Sparkles } from "lucide-react";
import { Notice, PageHeader } from "@/components/ui/core";
import { PLATFORM_SPECS, CHANNELS } from "@/lib/platforms/specs";

const futureControls = [
  { label: "Prompt", value: "A monsoon Kolkata night, slow dolly toward the lead…" },
  { label: "Duration", value: "4 to 15 seconds" },
  { label: "Aspect", value: "9:16 Reels & Shorts · 1:1 X" },
  { label: "Audio", value: "Optional bed + captions later" },
];

export default function VideoStudioPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Next release"
        title="AI Video Studio is in development for the next release."
        description="This workspace is turned off for now. Images, review, publish, and insights stay reliable first. Video comes in the next release."
      />

      <Notice title="Images ship first. Video comes next.">
        Video is paused so the image, review, publish, and insights loop stays reliable. Use Image Studio for this release.
      </Notice>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="surface-card p-6 md:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-white text-black">
              <Clapperboard className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium">Future channel controls</p>
              <p className="text-xs text-zinc-500">Preview only · Generate is disabled</p>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {futureControls.map((control) => (
              <label key={control.label} className="block text-sm text-zinc-400">
                <span className="mb-2 block">{control.label}</span>
                <input disabled value={control.value} className="input cursor-not-allowed opacity-60" />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled
            className="mt-6 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-white/10 px-4 text-sm text-zinc-500"
          >
            <Lock className="size-4" /> Generate video, coming in the next release
          </button>
        </article>

        <aside className="space-y-4">
          <section className="gradient-spotlight rounded-[30px] p-6">
            <Clock3 className="size-5" />
            <h2 className="mt-6 text-2xl font-medium tracking-[-0.04em]">What ships after images</h2>
            <ul className="mt-5 space-y-3 text-sm text-white/75">
              <li>A unique video for Instagram, YouTube, and X. Not one clip cropped three ways.</li>
              <li>The same human review before anything can be scheduled.</li>
              <li>Image and video results next to each other in Performance.</li>
            </ul>
          </section>
          <section className="surface-card p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-[#0099ff]" /> Planned channel shapes
            </p>
            <div className="space-y-2 text-xs text-zinc-500">
              {CHANNELS.map((channel) => {
                const spec = PLATFORM_SPECS[channel];
                return (
                  <p key={channel}>
                    {spec.label}: {spec.video.aspect}, up to {spec.video.maxDurationSec} seconds
                  </p>
                );
              })}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
