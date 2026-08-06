# Configurações

O módulo de Configurações é uma central administrativa acessível somente por administradores. A rota principal é `#/configuracoes`; as categorias usam `#/configuracoes?section=<categoria>`, preservando o breadcrumb e o botão Voltar do navegador.

## Categorias

- Empresa: dados cadastrais, endereço, contatos, fiscal e observações institucionais.
- Usuários: consulta os perfis existentes; criação e alteração de acesso dependem do fluxo seguro do Supabase Auth.
- Marca: preview dos três ativos oficiais, upload da logo principal e tokens visuais preparados para persistência.
- Impressão: preferências do recibo térmico e referência da impressora. A escolha física continua no diálogo do navegador/sistema.
- Integrações e Notificações: interface preparada, sem credenciais no frontend e sem automações simuladas.
- Segurança: ações sensíveis e autenticação adicional ficam explicitamente marcadas como dependentes da infraestrutura correspondente.
- Operação: regras com validação mínima para prazo de reserva, finalização e edição.
- Sistema: versão, dados disponíveis e limpeza segura apenas de chaves locais iniciadas por `vb-`.

## Persistência

As configurações globais usam a tabela existente `settings`, com `key`, `value`, `updated_at` e `updated_by`. O serviço local do módulo centraliza leitura (`loadSettingsData`), merge (`mergeSettingValue`) e gravação (`saveSetting`). Não foi criada uma tabela paralela.

As chaves usadas são `company`, `receipt`, `branding` e `operation`, além das chaves legadas já existentes de estoque e pedidos. Preferências estritamente locais não devem ser gravadas como configurações globais.

## Marca e empresa

Os caminhos oficiais das logos continuam centralizados em `assets/js/config/branding.js`. O upload da logo principal usa o bucket `company-assets`, sem espalhar URLs pelo restante da aplicação. A logo é validada para PNG, JPG, SVG ou WEBP.

## Impressão

O formato salvo é `thermal_80mm`. Isso não substitui a configuração de A4 para relatórios e demais documentos: a impressão térmica permanece isolada no fluxo do recibo. Navegadores não permitem selecionar silenciosamente uma impressora USB pelo frontend.

## Segurança e permissões

O roteador e o módulo bloqueiam Configurações para o perfil `seller`. Tokens de integrações, senhas e credenciais não são expostos ou armazenados no frontend. A criação real de usuários, envio de recuperação de senha, sessões completas e integrações externas ficam preparados para uma camada segura de backend/Edge Function.

## Como expandir

Para acrescentar uma categoria, adicione a definição em `settingsCategories`, implemente seu conteúdo em `renderSettingsCategory` e mantenha a persistência passando por `saveSetting`. Ações de credenciais devem ser implementadas em backend e jamais em `localStorage`.

## Usuários com login

Contas existentes continuam entrando com e-mail. Novas contas usam `username` e senha: o navegador converte apenas o identificador em um e-mail técnico interno e a senha é validada pelo Supabase Auth. O nome de usuário aceita letras minúsculas, números, ponto, hífen e underline, com 3 a 32 caracteres.

Para ativar a criação, execute `database/sql/013_usernames_and_admin_users.sql` no SQL Editor e publique `supabase/functions/admin-users`. A função recebe a credencial de serviço apenas no ambiente seguro da Edge Function e confirma que o solicitante é administrador antes de criar ou alterar contas.

Perfis inativos continuam bloqueados pelas funções `is_active_user()` e `is_admin()` já usadas nas políticas RLS. Além disso, a Edge Function bane a conta no Supabase Auth ao desativar e remove o banimento ao reativar. O último administrador ativo, bem como a própria conta do administrador logado, não pode ser desativado ou rebaixado.

`last_login_at` é atualizado após um login válido por `record_profile_login()`. Para produção, configure `ADMIN_ALLOWED_ORIGINS` na Edge Function com as origens autorizadas do Admin, separadas por vírgula; a função não usa CORS aberto.
