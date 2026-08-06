"use client";

import { Button } from "@/components/ui/button";

type GlobalErrorProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <main id="main-content">
      <section className="ds-empty" aria-labelledby="global-error-title">
        <h1 id="global-error-title">Não foi possível carregar esta página</h1>
        <p>Tente novamente. Se o problema persistir, volte mais tarde.</p>
        <Button type="button" onClick={reset}>
          Tentar novamente
        </Button>
      </section>
    </main>
  );
}
