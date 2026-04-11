"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth";

export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password, rememberMe);
      onLogin();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al iniciar sesión. Verificá tus credenciales.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[22rem]">

        {/* Logo + título */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface">
            <svg viewBox="0 0 512 512" className="h-9 w-9">
              <rect width="512" height="512" rx="108" fill="#0d0d0f"/>
              <rect x="96" y="100" width="272" height="322" rx="12" fill="#000" opacity="0.22"/>
              <rect x="90" y="94" width="272" height="324" rx="14" fill="#ede8dd"/>
              <rect x="90" y="94" width="46" height="324" rx="12" fill="#c8905a"/>
              <rect x="120" y="94" width="16" height="324" fill="#c8905a"/>
              <circle cx="113" cy="168" r="5" fill="#1a0e06" opacity="0.42"/>
              <circle cx="113" cy="256" r="5" fill="#1a0e06" opacity="0.42"/>
              <circle cx="113" cy="344" r="5" fill="#1a0e06" opacity="0.42"/>
              <rect x="152" y="186" width="182" height="3" rx="1.5" fill="#1a0e06" opacity="0.11"/>
              <rect x="152" y="228" width="182" height="3" rx="1.5" fill="#1a0e06" opacity="0.11"/>
              <rect x="152" y="270" width="182" height="3" rx="1.5" fill="#1a0e06" opacity="0.11"/>
              <rect x="152" y="312" width="124" height="3" rx="1.5" fill="#1a0e06" opacity="0.11"/>
              <path d="M310 94 L338 94 L338 150 L324 138 L310 150 Z" fill="#c8905a" opacity="0.86"/>
            </svg>
          </div>
          <p className="section-kicker">private life</p>
          <h1 className="mt-2 text-xl font-medium tracking-[-0.03em] text-foreground">
            Bienvenido de vuelta.
          </h1>
        </div>

        {/* Formulario */}
        <form
          className="grid gap-4 rounded-xl border border-border bg-surface px-5 py-6"
          onSubmit={handleSubmit}
          autoComplete="on"
        >
          <label className="grid gap-1.5 text-xs">
            <span className="font-medium uppercase tracking-wide text-muted">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="field"
              autoFocus
              required
              autoComplete="email"
            />
          </label>

          <label className="grid gap-1.5 text-xs">
            <span className="font-medium uppercase tracking-wide text-muted">Contraseña</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="field pr-14"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.67rem] uppercase tracking-wide text-muted transition-colors hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
          </label>

          <label className="flex cursor-pointer items-center gap-2.5 pt-0.5">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="login-checkbox"
            />
            <span className="text-sm text-muted">Recordar sesión</span>
          </label>

          {error ? (
            <p className="text-xs leading-5" style={{ color: "var(--rose)" }}>
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="primary-button w-full justify-center"
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
