"use client";

import type { ReactNode } from "react";

const VIDEO_SRC =
  "https://cdn.midjourney.com/video/71048e88-d8e6-470e-88ef-555c01eacb12/0.mp4";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black px-4 py-8 sm:px-6">
      <video
        className="pointer-events-none fixed inset-0 h-full w-full scale-105 object-cover"
        src={VIDEO_SRC}
        muted
        loop
        autoPlay
        playsInline
        aria-hidden
      />
      <div className="fixed inset-0 bg-black/10 backdrop-blur-sm" aria-hidden />

      <div className="relative z-10 flex w-full max-w-[1040px] min-h-[650px] flex-col overflow-hidden rounded-[2.5rem] border border-gray-200 bg-white shadow-[0_25px_80px_rgba(0,0,0,0.45)] md:flex-row">
        <div className="relative hidden w-full overflow-hidden rounded-[2rem] bg-[#0c0c0e] md:block md:w-[45%] md:m-3 md:min-h-[calc(650px-1.5rem)]">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={VIDEO_SRC}
            muted
            loop
            autoPlay
            playsInline
            aria-hidden
          />
        </div>

        <div className="relative flex w-full flex-1 flex-col justify-center px-6 py-10 sm:px-10 md:w-[55%] md:px-12 md:py-12">
          <div
            className="pointer-events-none absolute left-0 top-0 h-64 w-64 rounded-full opacity-20 blur-[80px]"
            style={{
              background: "linear-gradient(135deg, #FF512F, #F09819)",
            }}
            aria-hidden
          />
          <div className="relative z-[1] w-full">{children}</div>
        </div>
      </div>
    </div>
  );
}

export { VIDEO_SRC };
