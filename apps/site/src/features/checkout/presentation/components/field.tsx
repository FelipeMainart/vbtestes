import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import styles from "./checkout.module.css";

type Props = ComponentProps<typeof Input> &
  Readonly<{ error?: string; label: string }>;

export function Field({ error, id, label, ...props }: Props) {
  const errorId = `${id}-error`;
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}</span>
      <Input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        id={id}
        {...props}
      />
      {error && (
        <small id={errorId} role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
