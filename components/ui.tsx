"use client";

import { useState, type ReactNode, type TextareaHTMLAttributes } from "react";

interface CardProps {
  title: string;
  step?: number;
  subtitle?: string;
  children: ReactNode;
  disabled?: boolean;
}

export function Card({ title, step, subtitle, children, disabled }: CardProps) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-lg transition ${
        disabled ? "opacity-50" : "opacity-100"
      }`}
    >
      <header className="mb-4 flex items-baseline gap-3">
        {step !== undefined && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-300">
            {step}
          </span>
        )}
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            {title}
          </h2>
          {subtitle && <p className="text-sm text-white/50">{subtitle}</p>}
        </div>
      </header>
      <div className={disabled ? "pointer-events-none" : ""}>{children}</div>
    </section>
  );
}

interface ButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: ReactNode;
  variant?: "primary" | "secondary";
}

export function Button({
  onClick,
  disabled,
  loading,
  children,
  variant = "primary",
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
  const styles =
    variant === "primary"
      ? "bg-indigo-500 text-white hover:bg-indigo-400"
      : "border border-white/15 bg-white/5 text-white hover:bg-white/10";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${styles}`}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      )}
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-white/70">
        {label}
      </span>
      {children}
    </label>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  rows?: number;
};

export function Textarea({ rows = 10, className = "", ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={`w-full resize-y rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-sm leading-relaxed text-white/90 outline-none transition placeholder:text-white/30 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 ${className}`}
      {...props}
    />
  );
}

export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. non-secure context) — silently ignore.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {message}
    </div>
  );
}
