"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthFieldProps = {
  label: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

export function AuthField({ label, className, id, type, ...props }: AuthFieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const isPassword = type === "password";
  const [visible, setVisible] = useState(false);

  return (
    <div
      className={cn(
        "auth-field rounded-[1.25rem] border border-gray-200 bg-gray-50 p-2 transition-colors",
        "focus-within:border-gray-300 focus-within:bg-white",
        className
      )}
    >
      <label htmlFor={fieldId} className="block px-3 pt-1.5 text-[11px] font-medium text-gray-500">
        {label}
      </label>
      <div className={cn("relative", isPassword && "pr-10")}>
        <input
          id={fieldId}
          type={isPassword ? (visible ? "text" : "password") : type}
          className="auth-field-input w-full bg-transparent px-3 pb-2 pt-0.5 text-[15px] text-gray-900 outline-none ring-0 placeholder:text-gray-400 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            className="auth-field-toggle absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
