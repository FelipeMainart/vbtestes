"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Circle,
  CreditCard,
  LockKeyhole,
  QrCode,
  Truck,
} from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { ROUTES, orderSuccessRoute } from "@/constants/routes";
import type { OrderBuilderProduct } from "@/features/product";
import { cartService } from "@/lib/composition/cart.client";
import { localOrderRepository } from "@/lib/composition/orders.client";
import type { PaymentOption } from "@/services/interfaces/payment-service";
import type { ShippingOption } from "@/services/interfaces/shipping-service";

import {
  addressSchema,
  customerSchema,
} from "../../application/schemas/checkout.schema";
import type { CheckoutSnapshot } from "../../domain/entities/checkout";
import {
  calculateShippingAction,
  confirmOrderAction,
  lookupAddressAction,
  prepareCheckoutAction,
} from "../actions/checkout.actions";
import { CheckoutSummary } from "./checkout-summary";
import { Field } from "./field";
import { formatCheckoutPrice } from "../utils/format-checkout-price";
import styles from "./checkout.module.css";

const formSchema = z.object({
  address: addressSchema,
  customer: customerSchema,
});
type FormValues = z.infer<typeof formSchema>;
const visualSteps = ["Dados", "Entrega", "Pagamento", "Revisão"] as const;

type Props = Readonly<{
  paymentOptions: readonly PaymentOption[];
  products: readonly OrderBuilderProduct[];
}>;

export function CheckoutPage({ paymentOptions, products }: Props) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CheckoutSnapshot | null>(null);
  const [step, setStep] = useState(0);
  const [shippingOptions, setShippingOptions] = useState<
    readonly ShippingOption[]
  >([]);
  const [shippingId, setShippingId] = useState<ShippingOption["id"] | null>(
    null,
  );
  const [paymentId, setPaymentId] = useState<PaymentOption["id"] | null>(null);
  const [fullName, setFullName] = useState("");
  const [fullNameError, setFullNameError] = useState<string | undefined>();
  const [status, setStatus] = useState("Validando seu pedido…");
  const [isPending, setIsPending] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const form = useForm<FormValues>({
    defaultValues: {
      address: {
        city: "",
        complement: "",
        neighborhood: "",
        number: "",
        postalCode: "",
        state: "",
        street: "",
      },
      customer: { cpf: "", email: "", firstName: "", lastName: "", phone: "" },
    },
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    let active = true;
    async function initialize() {
      const cart = await cartService.load(products);
      const prepared = await prepareCheckoutAction(cart.lines);
      if (!active) return;
      if (!prepared.ok) {
        router.replace(`${ROUTES.home}?checkout=minimum#modelos`);
        return;
      }
      setSnapshot(prepared.snapshot);
      const search = new URLSearchParams(window.location.search);
      const initialPostalCode = search.get("postalCode");
      const initialShippingId = search.get("shipping");
      if (initialPostalCode?.replace(/\D/g, "").length === 8) {
        form.setValue("address.postalCode", initialPostalCode);
        const options = await calculateShippingAction(initialPostalCode);
        if (!active) return;
        setShippingOptions(options);
        const matchingShipping = options.find(
          (option) => option.id === initialShippingId,
        );
        if (matchingShipping) setShippingId(matchingShipping.id);
      }
      setStatus("");
    }
    void initialize();
    return () => {
      active = false;
    };
  }, [form, products, router]);

  const selectedShipping = shippingOptions.find(
    (item) => item.id === shippingId,
  );
  const selectedPayment = paymentOptions.find((item) => item.id === paymentId);
  const visiblePaymentOptions = paymentOptions.filter(
    (option) => option.id !== "boleto",
  );
  const visualStep: 0 | 1 | 2 | 3 =
    step === 0 ? 0 : step === 1 ? 1 : step === 3 ? 2 : 3;

  async function advanceFromCustomer() {
    const names = fullName.trim().split(/\s+/);
    if (names.length < 2) {
      setFullNameError("Informe nome e sobrenome.");
      return;
    }
    form.setValue("customer.firstName", names[0], { shouldValidate: true });
    form.setValue("customer.lastName", names.slice(1).join(" "), {
      shouldValidate: true,
    });
    setFullNameError(undefined);
    if (await form.trigger("customer", { shouldFocus: true })) setStep(1);
  }
  async function findAddress() {
    if (!(await form.trigger("address.postalCode", { shouldFocus: true })))
      return;
    setIsPending(true);
    const result = await lookupAddressAction(
      form.getValues("address.postalCode"),
    );
    if (result) {
      form.setValue("address.street", result.street, { shouldValidate: true });
      form.setValue("address.neighborhood", result.neighborhood, {
        shouldValidate: true,
      });
      form.setValue("address.city", result.city, { shouldValidate: true });
      form.setValue("address.state", result.state, { shouldValidate: true });
      setStatus("Endereço encontrado. Revise os dados antes de continuar.");
    } else
      setStatus(
        "Não foi possível localizar este CEP. Revise e tente novamente.",
      );
    setIsPending(false);
  }
  async function advanceFromAddress() {
    if (!(await form.trigger("address", { shouldFocus: true }))) return;
    await calculateShipping();
  }
  async function continueFromDelivery() {
    if (shippingId && (await form.trigger("address", { shouldFocus: true }))) {
      setStep(3);
    }
  }
  async function calculateShipping() {
    if (!(await form.trigger("address.postalCode", { shouldFocus: true })))
      return;
    setIsPending(true);
    const options = await calculateShippingAction(
      form.getValues("address.postalCode"),
    );
    setShippingOptions(options);
    setStatus("Opções de entrega disponíveis. Escolha a melhor para você.");
    setIsPending(false);
  }
  async function confirmOrder() {
    if (!snapshot || !shippingId || !paymentId) return;
    setIsPending(true);
    idempotencyKey.current ??= crypto.randomUUID();
    const result = await confirmOrderAction({
      ...form.getValues(),
      idempotencyKey: idempotencyKey.current,
      lines: snapshot.lines,
      paymentId,
      shippingId,
    });
    if (!result.ok) {
      setStatus(
        "Não foi possível confirmar o pedido. Revise os dados e tente novamente.",
      );
      setIsPending(false);
      return;
    }
    const wasPersisted = localOrderRepository.save(result.order);
    if (!wasPersisted) {
      setStatus(
        "O pedido foi confirmado, mas não foi possível preparar a página de sucesso neste navegador. Libere o armazenamento local e tente novamente.",
      );
      setIsPending(false);
      return;
    }
    await cartService.clear();
    router.push(orderSuccessRoute(result.orderId) as Route);
  }

  if (!snapshot)
    return (
      <div className={styles.loading} role="status">
        {status}
      </div>
    );

  return (
    <div className={styles.checkoutPage}>
      <header className={styles.checkoutHeader}>
        <div className={styles.checkoutHeaderInner}>
          <Link href={ROUTES.home} className={styles.brand}>
            <Image
              alt="Veste Bem Moda Alfaiataria"
              className={styles.checkoutLogo}
              height={36}
              sizes="(max-width: 47.99rem) 125px, 180px"
              src="/images/brand/veste-bem-logo.webp"
              width={216}
            />
          </Link>
          <span className={styles.checkoutSecure}>
            <LockKeyhole aria-hidden="true" size={17} strokeWidth={2} />
            Checkout seguro
          </span>
          <Link className={styles.checkoutBack} href={`${ROUTES.home}#modelos`}>
            <ArrowLeft aria-hidden="true" size={16} /> Voltar ao pedido
          </Link>
        </div>
      </header>
      <div className={styles.mobileSummary}>
        <details>
          <summary>
            <span>Ver resumo do pedido</span>
            <strong>
              {formatCheckoutPrice(
                snapshot.summary.subtotalInCents +
                  (selectedShipping?.priceInCents ?? 0),
              )}
            </strong>
            <ChevronDown aria-hidden="true" size={18} />
          </summary>
          <CheckoutSummary
            currentStep={visualStep}
            shipping={selectedShipping}
            snapshot={snapshot}
          />
        </details>
      </div>
      <div className={styles.checkoutGrid}>
        <main className={styles.formColumn}>
          <div
            className={styles.mobileStep}
            aria-label={`Etapa ${visualStep + 1} de 4`}
          >
            <span>Etapa {visualStep + 1} de 4</span>
            <strong>{visualSteps[visualStep]}</strong>
            <progress max={4} value={visualStep + 1} />
          </div>
          <ol className={styles.steps} aria-label="Etapas do checkout">
            {visualSteps.map((label, index) => (
              <li
                aria-current={index === visualStep ? "step" : undefined}
                data-active={index === visualStep}
                data-complete={index < visualStep}
                key={label}
              >
                <span>
                  {index < visualStep ? (
                    <Check aria-hidden="true" size={14} />
                  ) : (
                    <Circle
                      aria-hidden="true"
                      fill={index === visualStep ? "currentColor" : "none"}
                      size={9}
                    />
                  )}
                </span>
                {label}
              </li>
            ))}
          </ol>
          <form onSubmit={(event) => event.preventDefault()}>
            {step === 0 && (
              <section
                className={styles.section}
                aria-labelledby="customer-title"
              >
                <div>
                  <p>Dados</p>
                  <h1 id="customer-title">Seus dados</h1>
                  <span>
                    Preencha uma vez. O restante da compra será bem rápido.
                  </span>
                </div>
                <div className={styles.formGroup}>
                  <div className={styles.groupHeading}>
                    <h2>Dados para contato</h2>
                    <p>
                      Usaremos essas informações para atualizar você sobre seu
                      pedido.
                    </p>
                  </div>
                  <Field
                    autoComplete="name"
                    error={fullNameError}
                    id="fullName"
                    label="Nome completo"
                    onChange={(event) => {
                      setFullName(event.target.value);
                      setFullNameError(undefined);
                    }}
                    value={fullName}
                  />
                  <div className={styles.twoColumns}>
                    <Field
                      autoComplete="tel"
                      error={form.formState.errors.customer?.phone?.message}
                      id="phone"
                      label="Telefone"
                      {...form.register("customer.phone")}
                    />
                    <Field
                      autoComplete="email"
                      error={form.formState.errors.customer?.email?.message}
                      id="email"
                      label="E-mail"
                      type="email"
                      {...form.register("customer.email")}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <div className={styles.groupHeading}>
                    <h2>Dados fiscais</h2>
                    <p>
                      Necessário para emissão da nota fiscal e envio do pedido.
                    </p>
                  </div>
                  <Field
                    error={form.formState.errors.customer?.cpf?.message}
                    id="cpf"
                    label="CPF (opcional)"
                    {...form.register("customer.cpf")}
                  />
                </div>
                <Button
                  className={styles.primaryAction}
                  onClick={() => void advanceFromCustomer()}
                >
                  Continuar
                </Button>
              </section>
            )}
            {step === 1 && (
              <section
                className={styles.section}
                aria-labelledby="address-title"
              >
                <div>
                  <p>Dados</p>
                  <h1 id="address-title">Endereço de entrega</h1>
                  <span>Entregamos para todo o Brasil.</span>
                </div>
                <div className={styles.addressFields}>
                  <div className={styles.inlineAction}>
                    <Field
                      autoComplete="postal-code"
                      error={form.formState.errors.address?.postalCode?.message}
                      id="postalCode"
                      label="CEP"
                      {...form.register("address.postalCode")}
                    />
                    <Button
                      disabled={isPending}
                      onClick={() => void findAddress()}
                      variant="secondary"
                    >
                      Buscar CEP
                    </Button>
                  </div>
                  <Field
                    autoComplete="address-line1"
                    error={form.formState.errors.address?.street?.message}
                    id="street"
                    label="Rua"
                    {...form.register("address.street")}
                  />
                  <div className={styles.twoColumns}>
                    <Field
                      error={form.formState.errors.address?.number?.message}
                      id="number"
                      label="Número ou S/N"
                      {...form.register("address.number")}
                    />
                    <Field
                      id="complement"
                      label="Complemento (opcional)"
                      {...form.register("address.complement")}
                    />
                  </div>
                  <Field
                    error={form.formState.errors.address?.neighborhood?.message}
                    id="neighborhood"
                    label="Bairro"
                    {...form.register("address.neighborhood")}
                  />
                  <div className={styles.twoColumns}>
                    <Field
                      error={form.formState.errors.address?.city?.message}
                      id="city"
                      label="Cidade"
                      {...form.register("address.city")}
                    />
                    <Field
                      error={form.formState.errors.address?.state?.message}
                      id="state"
                      label="Estado"
                      maxLength={2}
                      {...form.register("address.state")}
                    />
                  </div>
                </div>
                <div className={styles.deliveryGroup}>
                  <div className={styles.groupHeading}>
                    <h2>Escolha da entrega</h2>
                    <p>
                      Compare prazo e valor para escolher com tranquilidade.
                    </p>
                  </div>
                  {shippingOptions.length === 0 ? (
                    <Button
                      disabled={isPending}
                      onClick={() => void advanceFromAddress()}
                      variant="secondary"
                    >
                      Calcular entrega
                    </Button>
                  ) : (
                    <fieldset className={styles.optionList}>
                      <legend className={styles.srOnly}>
                        Escolha a forma de entrega
                      </legend>
                      {shippingOptions.map((option) => (
                        <label
                          className={styles.optionCard}
                          data-selected={shippingId === option.id}
                          key={option.id}
                        >
                          <span
                            className={styles.optionIcon}
                            aria-hidden="true"
                          >
                            <Truck size={20} />
                          </span>
                          <input
                            checked={shippingId === option.id}
                            name="shipping"
                            onChange={() => setShippingId(option.id)}
                            type="radio"
                          />
                          <span>
                            <strong>{option.label}</strong>
                            <small className={styles.optionDescription}>
                              {option.id === "pac"
                                ? "Entrega econômica"
                                : option.id === "sedex"
                                  ? "Entrega rápida"
                                  : "Entrega expressa"}
                            </small>
                            <small>{option.deliveryEstimate}</small>
                          </span>
                          <strong>
                            {formatCheckoutPrice(option.priceInCents)}
                          </strong>
                        </label>
                      ))}
                    </fieldset>
                  )}
                </div>
                <div className={styles.actions}>
                  <Button onClick={() => setStep(0)} variant="secondary">
                    Voltar
                  </Button>
                  <Button
                    disabled={!shippingId}
                    onClick={() => void continueFromDelivery()}
                  >
                    Continuar
                  </Button>
                </div>
              </section>
            )}
            {step === 3 && (
              <section
                className={styles.section}
                aria-labelledby="payment-title"
              >
                <div>
                  <p>Finalização</p>
                  <h1 id="payment-title">Forma de pagamento</h1>
                  <span>Escolha como deseja concluir seu pedido.</span>
                </div>
                <fieldset className={styles.optionList}>
                  <legend className={styles.srOnly}>
                    Escolha a forma de pagamento
                  </legend>
                  {visiblePaymentOptions.map((option) => {
                    const PaymentIcon =
                      option.id === "pix" ? QrCode : CreditCard;
                    return (
                      <label
                        className={styles.optionCard}
                        data-selected={paymentId === option.id}
                        key={option.id}
                      >
                        <input
                          checked={paymentId === option.id}
                          name="payment"
                          onChange={() => setPaymentId(option.id)}
                          type="radio"
                        />
                        <span className={styles.optionIcon} aria-hidden="true">
                          <PaymentIcon size={20} />
                        </span>
                        <span>
                          <strong>{option.label}</strong>
                          <small>
                            {option.id === "pix"
                              ? "Pagamento instantâneo. Receba as instruções após confirmar."
                              : "Visa, Mastercard e Elo · pagamento seguro."}
                          </small>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
                <p className={styles.paymentNotice}>
                  Ambiente de demonstração. Nenhuma cobrança será realizada
                  nesta versão.
                </p>
                <div className={styles.actions}>
                  <Button onClick={() => setStep(1)} variant="secondary">
                    Voltar
                  </Button>
                  <Button disabled={!paymentId} onClick={() => setStep(4)}>
                    Continuar
                  </Button>
                </div>
              </section>
            )}
            {step === 4 && selectedShipping && selectedPayment && (
              <section
                className={styles.section}
                aria-labelledby="review-title"
              >
                <div>
                  <p>Finalização</p>
                  <h1 id="review-title">Revise e confirme</h1>
                  <span>Confira suas informações antes de finalizar.</span>
                </div>
                <div className={styles.reviewCards}>
                  <article>
                    <div className={styles.reviewHeading}>
                      <h2>Dados</h2>
                      <button onClick={() => setStep(0)} type="button">
                        Editar
                      </button>
                    </div>
                    <p>
                      {form.getValues("customer.firstName")}{" "}
                      {form.getValues("customer.lastName")}
                    </p>
                    <p>
                      {form.getValues("customer.email")} ·{" "}
                      {form.getValues("customer.phone")}
                    </p>
                  </article>
                  <article>
                    <div className={styles.reviewHeading}>
                      <h2>Endereço</h2>
                      <button onClick={() => setStep(1)} type="button">
                        Editar
                      </button>
                    </div>
                    <p>
                      {form.getValues("address.street")},{" "}
                      {form.getValues("address.number")}{" "}
                      {form.getValues("address.complement")}
                    </p>
                    <p>
                      {form.getValues("address.neighborhood")} ·{" "}
                      {form.getValues("address.city")}/
                      {form.getValues("address.state")}
                    </p>
                  </article>
                  <article>
                    <div className={styles.reviewHeading}>
                      <h2>Entrega</h2>
                      <button onClick={() => setStep(1)} type="button">
                        Editar
                      </button>
                    </div>
                    <p>{selectedShipping.label}</p>
                    <p>{selectedShipping.deliveryEstimate}</p>
                    <p>{formatCheckoutPrice(selectedShipping.priceInCents)}</p>
                  </article>
                  <article>
                    <div className={styles.reviewHeading}>
                      <h2>Pagamento</h2>
                      <button onClick={() => setStep(3)} type="button">
                        Editar
                      </button>
                    </div>
                    <p>{selectedPayment.label}</p>
                  </article>
                  <article>
                    <div className={styles.reviewHeading}>
                      <h2>Resumo</h2>
                    </div>
                    <p>{snapshot.summary.totalPieces} peças no pedido</p>
                    <p>
                      Total:{" "}
                      {formatCheckoutPrice(
                        snapshot.summary.subtotalInCents +
                          selectedShipping.priceInCents,
                      )}
                    </p>
                  </article>
                </div>
                <div className={styles.actions}>
                  <Button onClick={() => setStep(3)} variant="secondary">
                    Voltar
                  </Button>
                  <Button
                    disabled={isPending}
                    onClick={() => void confirmOrder()}
                  >
                    {isPending ? "Confirmando…" : "Finalizar Pedido"}
                  </Button>
                </div>
              </section>
            )}
          </form>
          <p aria-live="polite" className={styles.liveStatus} role="status">
            {status}
          </p>
        </main>
        <aside className={styles.desktopSummary} aria-label="Resumo do pedido">
          <CheckoutSummary
            currentStep={visualStep}
            shipping={selectedShipping}
            snapshot={snapshot}
          />
        </aside>
      </div>
    </div>
  );
}
