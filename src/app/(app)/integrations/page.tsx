import { Clapperboard, MessageCircle, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/core";

const accounts = [
  {
    id: "instagram",
    label: "Instagram",
    handle: "@hoichoi",
    usedFor: "Reels",
    icon: Clapperboard,
  },
  {
    id: "youtube",
    label: "YouTube",
    handle: "hoichoi",
    usedFor: "Shorts",
    icon: Play,
  },
  {
    id: "x",
    label: "X",
    handle: "@hoichoi",
    usedFor: "Posts",
    icon: MessageCircle,
  },
];

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Workspace"
        title="Connected accounts"
        description="Approved posts go out through these accounts after you schedule or publish."
      />

      <section className="flex flex-col gap-3">
        {accounts.map((account) => {
          const Icon = account.icon;
          return (
            <article
              key={account.id}
              className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-4">
                <span className="grid size-12 place-items-center rounded-full bg-white/6">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{account.label}</p>
                  <p className="mt-1 text-sm text-zinc-400">{account.handle}</p>
                  <p className="mt-0.5 text-xs text-zinc-600">Used for {account.usedFor}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 text-sm text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden />
                Connected
              </span>
            </article>
          );
        })}
      </section>
    </div>
  );
}
