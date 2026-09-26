import { describe, expect, it } from "vitest";
import { buildChannelImagePrompt, visualSubjectLine } from "@/lib/ai/prompts";

describe("image prompt follows the brief", () => {
  it("leads with the english subjects from the brief, not a generic still", () => {
    const prompt = buildChannelImagePrompt({
      channel: "youtube_shorts",
      title: "অর্ণব সাইক্লোন",
      mustInclude: ["Aurnab", "cyclone", "Bay of Bengal", "tonight on hoichoi", "watch now"],
      mustAvoid: ["Spoilers", "graphic destruction"],
      sceneWorld:
        "A cyclone named Aurnab approaches the Bay of Bengal coast under a black sky, tin roofs lifting, one window still lit.",
      visualComposition:
        "Wide view of the same cyclone over the coast, tin roofs in the wind.",
    });

    expect(prompt.startsWith("Aurnab, cyclone, Bay of Bengal")).toBe(true);
    expect(prompt.indexOf("Aurnab")).toBeLessThan(prompt.indexOf("Photorealistic"));
    expect(prompt.toLowerCase()).not.toContain("car windshield");
    expect(prompt).toContain("Do not depict: Spoilers, graphic destruction");
    expect(prompt).not.toContain("tonight on hoichoi");
  });

  it("drops marketing phrases from the visual subject line", () => {
    expect(
      visualSubjectLine({
        title: "অর্ণব সাইক্লোন",
        mustInclude: ["cyclone", "watch now"],
      })
    ).toBe("cyclone, অর্ণব সাইক্লোন");
  });
});
