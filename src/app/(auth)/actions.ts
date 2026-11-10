"use server";

import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { endSession, startSession } from "@/lib/auth/session";
import { createUser, EmailTakenError, findUserByEmail, touchLogin } from "@/lib/auth/users";
import { LIMITS } from "@/shared/protocol";

export interface AuthFormState {
  /** Erro geral (ex.: senha errada). */
  error?: string;
  /** Erros por campo. */
  fields?: Partial<Record<"name" | "email" | "password", string>>;
  /** Valores para repreencher o formulário (nunca a senha). */
  values?: { name?: string; email?: string };
}

// Arquivo "use server" só pode exportar funções assíncronas: constantes ficam internas.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

export async function login(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = text(form, "email").trim();
  const password = text(form, "password");
  const values = { email };

  if (!email || !password) return { error: "Preencha e-mail e senha.", values };

  const user = await findUserByEmail(email);
  // Mesma mensagem para e-mail inexistente e senha errada: não revela quem tem conta.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "E-mail ou senha incorretos.", values };
  }

  await touchLogin(user.id);
  await startSession(user);
  redirect("/");
}

export async function signup(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const name = text(form, "name").trim().replace(/\s+/g, " ");
  const email = text(form, "email").trim();
  const password = text(form, "password");
  const values = { name, email };

  const fields: AuthFormState["fields"] = {};
  if (!name) fields.name = "Como você quer ser chamado?";
  else if (name.length > LIMITS.nameLength) fields.name = `Use até ${LIMITS.nameLength} caracteres.`;
  if (!EMAIL_PATTERN.test(email) || email.length > 254) fields.email = "Digite um e-mail válido.";
  if (password.length < PASSWORD_MIN) fields.password = `A senha precisa de pelo menos ${PASSWORD_MIN} caracteres.`;
  else if (password.length > PASSWORD_MAX) fields.password = `Use até ${PASSWORD_MAX} caracteres.`;
  if (Object.keys(fields).length > 0) return { fields, values };

  let user;
  try {
    user = await createUser({
      name,
      email,
      passwordHash: await hashPassword(password),
      legacyKey: text(form, "legacyKey") || null,
    });
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return { fields: { email: "Esse e-mail já tem conta. Que tal entrar?" }, values };
    }
    throw err;
  }

  await startSession(user);
  redirect("/");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}
