# Documentação do banco de dados

Esta pasta centraliza a documentação e o versionamento de todas as alterações estruturais futuras do banco de dados. Seu objetivo é permitir que essas alterações sejam revisadas, rastreadas e posteriormente reproduzidas no banco principal sem depender da memória da equipe ou do histórico do Supabase.

## Convenção

- Cada alteração deve ser registrada no diretório correspondente à sua natureza.
- Os arquivos devem possuir nomes descritivos em `snake_case`.
- Arquivos SQL devem começar com o cabeçalho documental padrão do projeto.
- Dependências, ordem de execução, decisões e cuidados operacionais devem ser registrados antes da inclusão de qualquer SQL.
- Alterações relacionadas devem manter referências explícitas entre seus arquivos.
- Estes documentos não substituem migrations automatizadas caso elas sejam adotadas futuramente.

## Diretórios

- `tables/`: tabelas, colunas, constraints, chaves e índices.
- `views/`: views e suas dependências.
- `functions/`: funções, procedures e triggers.
- `storage/`: buckets, configurações e regras relacionadas ao Storage.
- `policies/`: RLS, grants e demais políticas de acesso.
- `seeds/`: dados iniciais ou auxiliares necessários para preparar um ambiente.

## Ordem de execução

Quando os documentos forem aprovados e estiverem prontos para aplicação manual, a ordem padrão será:

1. `tables`
2. `views`
3. `functions`
4. `storage`
5. `policies`
6. `seeds`

Dependências específicas registradas nos cabeçalhos dos arquivos têm precedência sobre essa ordem geral.

## Execução

Nenhum arquivo desta pasta é executado automaticamente.
Todos servem como documentação e versionamento das alterações estruturais do banco.

Qualquer aplicação no banco deve acontecer somente após revisão e aprovação explícitas, utilizando um processo operacional definido para o ambiente de destino.

# Política Oficial do Banco de Dados

O diretório `/database` é a fonte oficial da estrutura do banco de dados do projeto. As regras abaixo são obrigatórias para toda alteração futura:

1. Nenhum SQL poderá ser executado diretamente no Supabase sem que exista antes um arquivo correspondente dentro de `/database`.
2. Toda alteração estrutural deve ser documentada e versionada no Git.
3. O conteúdo de `/database` representa a fonte oficial para tabelas, views, funções, triggers, policies, Storage, seeds e demais objetos estruturais.
4. O banco de testes serve exclusivamente para validar os scripts documentados e versionados.
5. O banco principal somente poderá receber SQL que já esteja documentado em `/database`, revisado, validado no banco de testes e versionado no Git.
6. Nenhum SQL pode existir apenas em conversas, mensagens, anotações externas ou no histórico do Supabase.
7. Toda alteração futura deve atualizar primeiro a arquitetura e a documentação, depois criar ou atualizar o arquivo SQL correspondente e somente então seguir para revisão e execução controlada.

Entregar um trecho SQL somente em uma conversa não constitui documentação válida. A entrega deve sempre identificar claramente o arquivo correspondente em `/database`. A existência de um arquivo SQL também não significa que ele tenha sido executado; o estado de execução deve ser informado separadamente.

# Fluxo Oficial

```text
1. Arquitetura
       ↓
2. Documentação
       ↓
3. Arquivo SQL em /database
       ↓
4. Revisão
       ↓
5. Execução no Supabase de Testes
       ↓
6. Validação
       ↓
7. Commit
       ↓
8. Execução no Banco Principal
```

Nenhuma etapa deve ser omitida. Uma execução no banco de testes ou no banco principal exige autorização explícita e não é realizada automaticamente pelos arquivos deste diretório.

# Estrutura da pasta

```text
database/
├── README.md
├── architecture.md
├── tables/
├── views/
├── policies/
├── functions/
├── storage/
└── seeds/
```

- `database/`: raiz oficial da arquitetura e do versionamento estrutural do banco.
- `tables/`: criação e evolução de tabelas, colunas, constraints, chaves, índices e triggers diretamente ligados às tabelas.
- `views/`: definição das projeções de dados destinadas a consumidores específicos.
- `policies/`: habilitação de RLS, grants, revokes e policies de acesso.
- `functions/`: funções, procedures, RPCs e triggers reutilizáveis.
- `storage/`: buckets, caminhos, limites e políticas relacionadas ao Supabase Storage.
- `seeds/`: dados iniciais ou auxiliares, determinísticos e específicos para preparação de ambientes.

# Histórico de Correções

## Correção V1 — `product_colors_seller_select_active`

A policy `product_colors_seller_select_active` foi simplificada para remover a
dependência da tabela `products`. A condição com `EXISTS` fazia consultas em
`product_colors` exigirem permissão adicional em `products`, causando o erro
`permission denied for table products` no Site.

A policy passou a validar somente `is_seller()` e `active = true`. Essa alteração
preserva o comportamento esperado para vendedores, que no Admin utilizam as views
`vw_products_seller` e `vw_stock_seller`, e elimina o acesso redundante a
`products`.

O histórico completo está documentado em `policies/product_colors.sql`.

Toda alteração em policies deverá ser documentada na pasta `/database`, no
diretório correspondente, antes de qualquer execução controlada no banco.
