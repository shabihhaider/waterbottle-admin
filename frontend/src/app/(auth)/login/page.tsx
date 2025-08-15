// src/app/(auth)/login/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import clsx from "clsx";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
  remember: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError, setValue } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { remember: true } });

  const { login } = useAuth();
  const router = useRouter();

  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("_remember_email");
    if (saved) setValue("email", saved);
  }, [setValue]);

  async function onSubmit(data: FormData) {
    setServerError(null);
    try {
      // 👇 send a plain object — api() will JSON-stringify + set Content-Type
      const res = await api<{ token: string; user: any }>("/auth/login", {
        method: "POST",
        body: { email: data.email, password: data.password },
      });

      if (data.remember) localStorage.setItem("_remember_email", data.email);
      else localStorage.removeItem("_remember_email");

      login(res.token, res.user);
      router.replace("/dashboard");
    } catch (e: any) {
      const msg =
        e?.body?.error ||
        e?.body?.details?.formErrors?.join?.(", ") ||
        e?.message ||
        "Unable to sign in. Check your credentials and try again.";
      setServerError(msg);
      setError("password", { type: "server", message: "" });
    }
  }

  return (
    <div className="relative min-h-[100svh] grid place-items-center overflow-hidden">
      <div className="absolute inset-0 app-gradient" />
      <div className="absolute -top-32 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        onSubmit={handleSubmit(onSubmit)}
        className="relative w-full max-w-md card p-6 md:p-8 rounded-2xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to manage HydroPak</p>
          </div>
        </div>

        {serverError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-lg border border-red-200/50 bg-red-50/60 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-300"
          >
            {serverError}
          </motion.div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                className={clsx(
                  "w-full border rounded-lg px-3 py-2 bg-background pl-10 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                  errors.email && "border-red-500"
                )}
                placeholder="you@example.com"
                {...register("email")}
              />
            </div>
            {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                className={clsx(
                  "w-full border rounded-lg px-3 py-2 bg-background pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                  errors.password && "border-red-500"
                )}
                placeholder="••••••••"
                {...register("password")}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-accent"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
            <div className="mt-2 flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 select-none">
                <input type="checkbox" className="h-4 w-4 rounded border-border" {...register("remember")} />
                Remember me
              </label>
              <a className="text-primary hover:underline" href="#">Forgot password?</a>
            </div>
          </div>

          <button
            disabled={isSubmitting}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg hover:opacity-90 transition inline-flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
          </button>
        </div>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our <a href="#" className="underline">Terms</a> and <a href="#" className="underline">Privacy Policy</a>.
        </div>
      </motion.form>
    </div>
  );
}
