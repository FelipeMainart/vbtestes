import Link from "next/link";

import { ROUTES } from "@/constants/routes";

export default function NotFound() {
  return (
    <main id="main-content">
      <section className="ds-empty" aria-labelledby="not-found-title">
        <h1 id="not-found-title">Página não encontrada</h1>
        <p>O endereço informado não corresponde a uma página disponível.</p>
        <Link className="ds-button ds-button--primary" href={ROUTES.home}>
          Voltar ao início
        </Link>
      </section>
    </main>
  );
}
