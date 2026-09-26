"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField } from "@/components/auth/AuthField";
import { GradientSubmit } from "@/components/auth/GradientSubmit";
import {
  AuthOrDivider,
  SocialButtons,
  SunsetLink,
} from "@/components/auth/SocialButtons";
import { signUp } from "@/lib/auth-client";
import { useToast } from "@/components/ui/Toast";

export default function SignupPage() {
  const router = useRouter();
  const { show } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signUp.email({
      name: name.trim() || "Studio User",
      email,
      password,
    });
    setLoading(false);
    if (res.error) {
      const message =
        res.error.message || "Could not create your account. Try a different email.";
      setError(message);
      show(message, "error");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-md space-y-6 text-center">
        <header>
          <h1 className="text-[40px] font-semibold tracking-tight text-gray-950 leading-none">
            Create your account
          </h1>
          <p className="mt-3 text-sm text-gray-500">Start with your email</p>
        </header>

        <SocialButtons />
        <AuthOrDivider />

        <form onSubmit={onSubmit} className="space-y-3 text-left">
          <AuthField
            label="Name"
            type="text"
            autoComplete="name"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <AuthField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="flex items-stretch gap-2">
            <AuthField
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="min-w-0 flex-1"
            />
            <GradientSubmit
              loading={loading}
              disabled={loading}
              aria-label="Create account"
              className="self-center"
            />
          </div>

          {error ? (
            <p className="text-center text-sm text-red-500" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <p className="text-sm text-gray-500">
          Already have an account?{" "}
          <SunsetLink href="/login">Sign in</SunsetLink>
        </p>
      </div>
    </AuthShell>
  );
}
