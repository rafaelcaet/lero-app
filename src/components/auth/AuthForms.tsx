"use client";

import Link from "next/link";
import { useActionState, useState, useSyncExternalStore, type InputHTMLAttributes, type ReactNode } from "react";
import { login, signup, type AuthFormState } from "@/app/(auth)/actions";
import { readLegacyWalletKey } from "@/session/walletKey";
import { LIMITS } from "@/shared/protocol";

const INITIAL: AuthFormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, INITIAL);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <Field
        label="Seu e-mail"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="Digite aqui seu e-mail"
        defaultValue={state.values?.email}
        autoFocus
        required
      />
      <PasswordField label="Sua senha" autoComplete="current-password" placeholder="Digite aqui sua senha" />
      <FormError message={state.error} />

      <div className="mt-2 flex flex-col gap-3">
        <PrimaryButton pending={pending} pendingLabel="Entrando…">
          Entrar no Lero
        </PrimaryButton>
        <SecondaryLink href="/cadastro">Criar conta</SecondaryLink>
      </div>
    </form>
  );
}

const noopSubscribe = () => () => {};

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, INITIAL);
  // Carteira de antes do login: a conta nova herda as Lerocoins deste navegador.
  const legacyKey = useSyncExternalStore(noopSubscribe, readLegacyWalletKey, () => "");
  const errors = state.fields ?? {};

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="legacyKey" value={legacyKey} />
      <Field
        label="Como você quer ser chamado?"
        name="name"
        autoComplete="nickname"
        placeholder="Seu nome no escritório"
        maxLength={LIMITS.nameLength}
        defaultValue={state.values?.name}
        error={errors.name}
        autoFocus
        required
      />
      <Field
        label="Seu e-mail"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="Digite aqui seu e-mail"
        defaultValue={state.values?.email}
        error={errors.email}
        required
      />
      <PasswordField
        label="Crie uma senha"
        autoComplete="new-password"
        placeholder="Mínimo de 8 caracteres"
        error={errors.password}
        hint="Pelo menos 8 caracteres."
      />
      <FormError message={state.error} />
      {legacyKey && (
        <p className="rounded-lg border border-aqua-400/30 bg-aqua-400/10 px-3 py-2 text-xs text-aqua-100">
          Suas Lerocoins e compras deste navegador vão junto para a nova conta.
        </p>
      )}

      <div className="mt-2 flex flex-col gap-3">
        <PrimaryButton pending={pending} pendingLabel="Criando conta…">
          Criar conta
        </PrimaryButton>
        <SecondaryLink href="/login">Já tenho conta</SecondaryLink>
      </div>
    </form>
  );
}

// --- peças -------------------------------------------------------------------

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
}

const inputClass =
  "h-11 w-full rounded-lg border-2 bg-grape-50 px-3.5 text-[15px] text-carbon placeholder:text-grape-500 outline-none transition-[border-color,box-shadow] focus:border-aqua-400 focus:ring-4 focus:ring-aqua-400/25";

function Field({ label, name, error, hint, trailing, ...input }: FieldProps) {
  const id = `field-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-grape-100">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputClass} ${error ? "border-red-400" : "border-transparent"} ${trailing ? "pr-12" : ""}`}
          {...input}
        />
        {trailing}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs font-semibold text-red-300">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-grape-400">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function PasswordField(props: Omit<FieldProps, "name" | "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      name="password"
      type={visible ? "text" : "password"}
      required
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Esconder senha" : "Mostrar senha"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-1 my-auto flex h-9 w-10 items-center justify-center rounded-md text-grape-600 hover:bg-grape-200 hover:text-carbon focus-visible:outline-2 focus-visible:outline-aqua-600"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  );
}

function FormError({ message }: { message?: string }) {
  return (
    <p aria-live="polite" className={message ? "rounded-lg bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-200" : "sr-only"}>
      {message}
    </p>
  );
}

function PrimaryButton({ pending, pendingLabel, children }: { pending: boolean; pendingLabel: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-block h-12 w-full rounded-xl border-aqua-700 bg-aqua-400 font-display text-base font-semibold uppercase tracking-wider text-carbon shadow-[0_8px_24px_-8px_var(--color-aqua-400)] outline-none focus-visible:ring-4 focus-visible:ring-aqua-400/40 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex h-11 w-full items-center justify-center rounded-xl border border-grape-600 bg-carbon/40 font-display text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:border-aqua-400/70 hover:bg-carbon/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-400"
    >
      {children}
    </Link>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.2 3.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20" />
    </svg>
  );
}
