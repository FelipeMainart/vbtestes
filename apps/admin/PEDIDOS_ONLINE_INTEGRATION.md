# Pedidos Online

O módulo de Pedidos Online é separado das vendas presenciais. Nesta etapa, a tela usa os pedidos existentes no Supabase e mantém o contrato preparado para receber pedidos do e-commerce.

## Identidade e idempotência

Cada pedido deve preservar `id` interno, `external_order_id`, `source` e um número legível como `PED-000142`. A chave de idempotência é `source:external_order_id`; uma nova entrega do mesmo webhook deve atualizar o pedido existente, nunca criar outro.

## Status

`awaiting_payment`, `paid`, `in_separation`, `awaiting_shipping`, `shipped`, `delivered`, `finalized`, `cancelled` e `expired`.

## Reserva de estoque

Ao receber um pedido, a integração deve reservar as variações por 24 horas e persistir `stock_reserved_at`, `stock_reservation_expires_at`, `stock_reservation_status`, `stock_released_at` e `stock_confirmed_at`. Pagamento aprovado confirma a reserva uma única vez. Expiração ou cancelamento antes do pagamento libera a reserva uma única vez.

O helper `assets/js/modules/ordersIntegration.js` contém validação do payload, chave de idempotência e cálculo de expiração. A expiração deve ser executada por Edge Function, cron ou job no backend, e não depender do navegador aberto. A operação precisa verificar o status atual antes de liberar estoque para ser idempotente.

## Payload esperado

O endpoint futuro deve receber `external_order_id`, `source`, `created_at`, `customer`, `shipping_address`, `items`, `pricing`, `payment` e `shipping`. Os itens precisam conter `product_id`, `variant_id`, `sku`, `quantity` e `unit_price`; SKU ou variação inexistente deve gerar erro de integração e impedir a reserva.

## Webhooks futuros

`order.created`, `payment.approved`, `payment.expired`, `payment.failed`, `order.cancelled`, `shipment.created`, `shipment.posted` e `shipment.delivered`. Validar assinatura, registrar a chave de idempotência e processar ações pesadas fora da resposta HTTP.

## Integração financeira

Pedidos finalizados devem alimentar uma camada unificada de transações com origem `site`, usando `order_id` como vínculo. Não deve ser criado um segundo faturamento para o mesmo pedido.

## Estado atual

A interface, filtros, período, status, drawer, rastreio e ações operacionais existentes estão preparados. Gateway Pix, Melhor Envio, webhooks, jobs de expiração e baixa/reserva transacional dependem da implementação backend e credenciais do e-commerce.
