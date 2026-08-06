"use client";

import {
  Boxes,
  CalendarDays,
  Check,
  Circle,
  MailCheck,
  MessageCircle,
  Package,
  PackageCheck,
  PackageX,
  ReceiptText,
  Search,
  Truck,
  UserRound,
  WalletCards,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { WHATSAPP_URL } from "@/constants/contact";

import styles from "./order-tracking.module.css";

const MOCK_ORDER_NUMBER = "VB202600001";
const MOCK_LOADING_DELAY = 650;

const timeline = [
  {
    icon: Check,
    label: "Pedido recebido",
    detail: "Recebemos e confirmamos as informações do pedido.",
  },
  {
    icon: PackageCheck,
    label: "Em separação",
    detail: "Modelos, cores e tamanhos estão sendo conferidos.",
  },
  {
    icon: Boxes,
    label: "Em produção",
    detail: "As peças seguem para preparação e acabamento.",
  },
  {
    icon: Truck,
    label: "Enviado",
    detail: "O rastreio ficará disponível após a postagem.",
  },
  { icon: Circle, label: "Entregue", detail: "Pedido entregue no destino." },
] as const;

const helpCards = [
  {
    icon: MailCheck,
    title: "Recebi confirmação",
    description: "Você receberá confirmação por e-mail e WhatsApp.",
  },
  {
    icon: Truck,
    title: "Prazo de envio",
    description: "Seu pedido é separado, conferido e enviado após confirmação.",
  },
  {
    icon: MessageCircle,
    title: "Precisa de ajuda?",
    description: "Nossa equipe responde rapidamente pelo WhatsApp.",
    action: true,
  },
] as const;

type TrackingViewState = "idle" | "loading" | "success" | "error";

function TrackingSkeleton() {
  return (
    <section
      className={styles.skeleton}
      aria-label="Consultando pedido"
      aria-live="polite"
    >
      <span className={styles.srOnly}>Consultando pedido…</span>
      <div className={styles.skeletonHeader}>
        <span />
        <span />
      </div>
      <div className={styles.skeletonOverview}>
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className={styles.skeletonTimeline}>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className={styles.skeletonDetails}>
        <span />
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

function TrackingError() {
  return (
    <section className={styles.errorState} aria-live="polite">
      <span aria-hidden="true">
        <PackageX size={30} strokeWidth={1.6} />
      </span>
      <h2>Pedido não encontrado</h2>
      <p>Confira os dados informados ou entre em contato com nossa equipe.</p>
      <a
        className="ds-button ds-button--primary"
        href={WHATSAPP_URL}
        rel="noreferrer"
        target="_blank"
      >
        <WhatsAppIcon aria-hidden="true" height={18} width={18} />
        Falar no WhatsApp
      </a>
    </section>
  );
}

function TrackingResult({ orderNumber }: Readonly<{ orderNumber: string }>) {
  return (
    <section className={styles.result} aria-live="polite">
      <div className={styles.resultHeading}>
        <div>
          <span>Pedido consultado</span>
          <h2>{orderNumber}</h2>
        </div>
        <span className={styles.badge}>Em separação</span>
      </div>

      <dl className={styles.orderOverview}>
        <div>
          <span aria-hidden="true">
            <PackageCheck size={18} />
          </span>
          <dt>Status</dt>
          <dd>Pedido confirmado</dd>
        </div>
        <div>
          <span aria-hidden="true">
            <UserRound size={18} />
          </span>
          <dt>Cliente</dt>
          <dd>Dados confirmados</dd>
        </div>
        <div>
          <span aria-hidden="true">
            <CalendarDays size={18} />
          </span>
          <dt>Data</dt>
          <dd>Confirmação registrada</dd>
        </div>
        <div>
          <span aria-hidden="true">
            <Boxes size={18} />
          </span>
          <dt>Quantidade</dt>
          <dd>6 peças</dd>
        </div>
        <div>
          <span aria-hidden="true">
            <WalletCards size={18} />
          </span>
          <dt>Valor</dt>
          <dd>Conforme resumo do pedido</dd>
        </div>
      </dl>

      <div className={styles.timelineHeading}>
        <span>Andamento</span>
        <h3>Seu pedido está em separação</h3>
      </div>
      <ol className={styles.timeline}>
        {timeline.map((item, index) => {
          const Icon = item.icon;
          const state =
            index === 0 ? "completed" : index === 1 ? "current" : "future";
          return (
            <li data-state={state} key={item.label}>
              <span>
                <Icon aria-hidden="true" size={18} />
              </span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </div>
            </li>
          );
        })}
      </ol>

      <div className={styles.details}>
        <div>
          <span>Produtos</span>
          <strong>2 modelos · 6 peças</strong>
        </div>
        <div>
          <span>Entrega</span>
          <strong>Todo o Brasil · prazo conforme checkout</strong>
        </div>
        <div>
          <span>Pagamento</span>
          <strong>Forma selecionada no checkout</strong>
        </div>
        <div>
          <span>Código de rastreio</span>
          <strong>Disponível após a postagem</strong>
        </div>
      </div>
    </section>
  );
}

export function OrderTrackingPage() {
  const [viewState, setViewState] = useState<TrackingViewState>("idle");
  const [queriedOrder, setQueriedOrder] = useState(MOCK_ORDER_NUMBER);
  const resultRegionRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (viewState !== "success" && viewState !== "error") return;

    const frameId = window.requestAnimationFrame(() => {
      const resultRegion = resultRegionRef.current;
      if (!resultRegion) return;

      const bounds = resultRegion.getBoundingClientRect();
      const isResultTopVisible =
        bounds.top >= 72 && bounds.top <= window.innerHeight * 0.72;

      if (!isResultTopVisible) {
        resultRegion.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [viewState]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const orderNumber = String(formData.get("order") ?? "")
      .trim()
      .toUpperCase();

    setQueriedOrder(orderNumber);
    setViewState("loading");

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setViewState(orderNumber === MOCK_ORDER_NUMBER ? "success" : "error");
    }, MOCK_LOADING_DELAY);
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="tracking-title">
        <div className={`ds-container ${styles.heroInner}`}>
          <p className={styles.eyebrow}>Acompanhamento de pedido</p>
          <div className={styles.heroTitle}>
            <span aria-hidden="true">
              <Package size={25} strokeWidth={1.7} />
            </span>
            <h1 id="tracking-title">Acompanhe cada etapa do seu pedido</h1>
          </div>
          <p className={styles.heroDescription}>
            Consulte rapidamente o andamento da sua compra utilizando o número
            do pedido e o e-mail ou WhatsApp informado no checkout.
          </p>
        </div>
      </section>

      <div className={`ds-container ${styles.content}`}>
        <section className={styles.consultation} aria-label="Consultar pedido">
          <form onSubmit={handleSubmit}>
            <label>
              <span>Número do pedido</span>
              <input
                className="ds-input"
                name="order"
                placeholder="Ex.: VB202600001"
                required
              />
            </label>
            <label>
              <span>E-mail ou WhatsApp</span>
              <input
                className="ds-input"
                name="contact"
                placeholder="voce@email.com ou (62) 99999-9999"
                required
              />
            </label>
            <Button disabled={viewState === "loading"} type="submit">
              <Search aria-hidden="true" size={18} />
              {viewState === "loading" ? "Consultando…" : "Consultar pedido"}
            </Button>
          </form>

          <div className={styles.orderNumberHelp}>
            <span className={styles.receiptIcon} aria-hidden="true">
              <ReceiptText size={23} strokeWidth={1.7} />
            </span>
            <div>
              <h2>Onde encontro meu número do pedido?</h2>
              <p>
                O número do pedido é enviado por e-mail e também pelo WhatsApp
                logo após a confirmação da compra.
              </p>
            </div>
            <a href={WHATSAPP_URL} rel="noreferrer" target="_blank">
              <WhatsAppIcon aria-hidden="true" height={17} width={17} />
              Falar no WhatsApp
            </a>
          </div>
        </section>

        {viewState !== "idle" && (
          <div
            className={styles.resultRegion}
            ref={resultRegionRef}
            tabIndex={-1}
          >
            {viewState === "loading" && <TrackingSkeleton />}
            {viewState === "success" && (
              <TrackingResult orderNumber={queriedOrder} />
            )}
            {viewState === "error" && <TrackingError />}
          </div>
        )}

        <section className={styles.helpSection} aria-labelledby="help-title">
          <div className={styles.sectionHeading}>
            <p className="ds-eyebrow">Jornada do pedido</p>
            <h2 id="help-title">Informações para acompanhar com segurança</h2>
          </div>
          <div className={styles.helpGrid}>
            {helpCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title}>
                  <span aria-hidden="true">
                    <Icon size={22} strokeWidth={1.7} />
                  </span>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  {"action" in card && card.action && (
                    <a href={WHATSAPP_URL} rel="noreferrer" target="_blank">
                      Falar com atendimento
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
