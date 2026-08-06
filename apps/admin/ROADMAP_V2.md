# Roadmap — Veste Bem v2

Este roadmap registra intenções. Escopo, ordem e stack poderão ser revistos antes da execução.

## Fase 1 — Homologação e base técnica

- Criar projeto Supabase de homologação.
- Criar deploy separado para homologação.
- Definir backup, restauração e rollback.
- Reconciliar o schema e criar baseline definitivo.
- Organizar migrations em `supabase/migrations`.
- Preservar os dois arquivos 013 até a reconciliação.
- Implantar CI.
- Criar testes unitários, de integração, RLS e E2E.

## Fase 2 — Experiência

- Revisar integralmente a UI.
- Refinar a experiência mobile.
- Criar PWA para computador e celular.
- Melhorar carregamento e performance.
- Executar auditoria e melhorias de acessibilidade.
- Avaliar possíveis mudanças de stack com análise de custo e migração.

## Fase 3 — E-commerce

- Finalizar o site.
- Integrar Site → Admin.
- Criar pedidos de forma transacional e idempotente.
- Implementar reserva e confirmação de estoque.
- Integrar Pix.
- Processar webhooks com assinatura, idempotência e retry.
- Integrar Melhor Envio.
- Sincronizar rastreio.

## Fase 4 — Comunicação

- Integrar WhatsApp Business API.
- Implementar e-mails automáticos.
- Criar templates versionados.
- Registrar envio, entrega, erro e tentativas.
- Definir filas e política de retry.

## Fase 5 — Expansão

- CRM.
- Atendimento.
- Central de notificações.
- BI e indicadores avançados.
- Automações operacionais e comerciais.

