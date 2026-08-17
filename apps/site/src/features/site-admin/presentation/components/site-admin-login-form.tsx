"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  loginSiteAdmin,
  type SiteAdminLoginState,
} from "../actions/site-admin-auth.action";
import styles from "./site-admin.module.css";

const initialState: SiteAdminLoginState = { message: "" };

export function SiteAdminLoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginSiteAdmin,
    initialState,
  );

  return (
    <form action={formAction} className={styles.loginForm}>
      <label className={styles.field}>
        <span>E-mail</span>
        <Input
          autoComplete="email"
          disabled={isPending}
          name="email"
          required
          type="email"
        />
      </label>
      <label className={styles.field}>
        <span>Senha</span>
        <Input
          autoComplete="current-password"
          disabled={isPending}
          minLength={1}
          name="password"
          required
          type="password"
        />
      </label>
      {state.message ? (
        <p aria-live="polite" className={styles.loginError} role="alert">
          {state.message}
        </p>
      ) : null}
      <Button disabled={isPending} type="submit">
        {isPending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
