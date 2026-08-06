# Proposta de Refatoracao - Cores de Produto como Entidade

Este documento e uma proposta tecnica para revisao antes de qualquer alteracao no banco ou no frontend.

Importante: nenhum SQL deste documento foi executado. A migracao so deve acontecer apos aprovacao explicita.

Status apos aprovacao da proposta: o arquivo local `database/sql/006_product_colors_refactor.sql` foi criado para revisao. Ele nao foi executado automaticamente.

## Problema identificado

A implementacao atual trata cor como texto dentro de `product_variations`.

Estrutura atual:

```text
products
└── product_variations
    ├── color
    ├── size
    ├── quantity
    └── minimum_stock
```

Isso funciona para estoque simples, mas nao e suficiente para Catalogo Online, Pedidos Online e Site futuro, porque a imagem pertence a cor, nao ao tamanho.

Exemplo do problema:

```text
Colete V Slim
├── Preto P
├── Preto M
└── Preto G
```

Se a imagem ficar vinculada a variacao, ela pode ser duplicada em `Preto P`, `Preto M` e `Preto G`. Se ficar apenas em `products.image_url`, o sistema nao consegue mostrar a imagem correta quando o cliente escolhe `Off White`, `Bege` ou `Preto`.

## Estrutura desejada

Nova estrutura conceitual:

```text
products
└── product_colors
    └── product_variations
```

Exemplo:

```text
Colete V Slim
├── Preto
│   ├── P: 4
│   ├── M: 8
│   └── G: 5
├── Off White
│   ├── P: 2
│   ├── M: 6
│   └── G: 3
└── Bege
    ├── P: 1
    ├── M: 3
    └── G: 4
```

Cada cor possui uma imagem unica, reutilizada por todos os tamanhos daquela cor.

## Alteracoes necessarias no banco

### Nova tabela `product_colors`

Objetivo: representar as cores disponiveis de cada produto e guardar a imagem especifica da cor.

Campos propostos:

| Campo | Tipo | Obrigatorio | Observacao |
|---|---|---:|---|
| `id` | uuid | sim | PK |
| `product_id` | uuid | sim | FK para `products.id` |
| `color_name` | text | sim | Nome exibido da cor |
| `image_url` | text | nao | URL publica da imagem no Storage |
| `active` | boolean | sim | Permite inativar cor sem exclusao fisica |
| `created_at` | timestamptz | sim | Criacao |
| `updated_at` | timestamptz | sim | Atualizacao |

Regras:

- `product_id + color_name` deve ser unico.
- Cores nao devem ser excluidas fisicamente quando ja existirem variacoes, vendas, pedidos ou historico.
- Para remover uma cor da operacao futura, usar `active = false`.
- A imagem da cor fica em `product_colors.image_url`, nao em `product_variations`.

### Alteracao em `product_variations`

Estrutura atual:

| Campo atual | Observacao |
|---|---|
| `product_id` | FK para produto |
| `color` | texto da cor |
| `size` | tamanho |
| `quantity` | estoque |
| `minimum_stock` | estoque minimo |
| `status` | ativo/inativo |

Estrutura desejada:

| Campo novo | Observacao |
|---|---|
| `product_id` | pode ser mantido por performance e compatibilidade |
| `product_color_id` | FK para `product_colors.id` |
| `size` | tamanho |
| `quantity` | estoque |
| `minimum_stock` | estoque minimo |
| `status` | `active` ou `inactive` |

Regra de unicidade desejada:

```text
product_color_id + size
```

Opcionalmente, manter `product_id` em `product_variations` para facilitar consultas, validando que `product_variations.product_id` corresponde ao `product_colors.product_id`.

## Rascunho de SQL para revisao

Nao executar automaticamente.

```sql
create table if not exists public.product_colors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  color_name text not null,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, color_name)
);

alter table public.product_variations
add column if not exists product_color_id uuid references public.product_colors(id);

create index if not exists product_colors_product_id_idx
on public.product_colors(product_id);

create index if not exists product_variations_product_color_id_idx
on public.product_variations(product_color_id);
```

Depois da migracao dos dados atuais, a restricao final desejada seria:

```sql
alter table public.product_variations
alter column product_color_id set not null;

alter table public.product_variations
add constraint product_variations_product_color_size_unique
unique (product_color_id, size);
```

Observacao: essa restricao final so deve ser aplicada depois de migrar todos os registros existentes de `color` para `product_colors`.

## Estrategia de migracao de dados

1. Criar `product_colors`.
2. Adicionar `product_color_id` em `product_variations`, inicialmente nullable.
3. Para cada par unico `product_id + color` em `product_variations`, criar um registro em `product_colors`.
4. Atualizar cada `product_variations.product_color_id` apontando para a cor criada.
5. Revisar duplicidades.
6. Aplicar `not null` em `product_color_id`.
7. Aplicar unicidade em `product_color_id + size`.
8. Manter temporariamente a coluna `color` em `product_variations` durante fase de compatibilidade, ou remover apenas em migracao posterior aprovada.

Rascunho de backfill para revisao:

```sql
insert into public.product_colors (product_id, color_name, active)
select distinct product_id, color, true
from public.product_variations
where color is not null
on conflict (product_id, color_name) do nothing;

update public.product_variations pv
set product_color_id = pc.id
from public.product_colors pc
where pc.product_id = pv.product_id
  and pc.color_name = pv.color
  and pv.product_color_id is null;
```

## Upload de imagens

Fluxo desejado apos aprovacao da migracao:

1. Criar ou atualizar o produto em `products`.
2. Para cada cor:
   - fazer upload da imagem no bucket `product-images`;
   - recuperar URL publica;
   - criar ou atualizar `product_colors.image_url`.
3. Criar variacoes em `product_variations` usando `product_color_id`.

Caminho sugerido no Storage:

```text
products/{productId}/colors/{productColorId}.{ext}
```

Motivo:

- O arquivo fica vinculado ao registro real da cor.
- Trocar o nome da cor nao quebra o caminho da imagem.
- Todos os tamanhos da cor reutilizam a mesma imagem.

## Listagem de produtos desejada

A tela principal de Produtos deve passar a exibir linhas agrupadas.

Linha principal:

```text
▶ Colete V Slim
Preco: R$ 56,00
Status: Ativo
Cores: 3
Variacoes: 9
Estoque Total: 36
```

Ao expandir:

```text
▼ Colete V Slim

[miniatura 60x60] Preto
P: 4
M: 8
G: 5
Estoque da cor: 17

[miniatura 60x60] Off White
P: 2
M: 6
G: 3
Estoque da cor: 11
```

## Edicao desejada

Ao editar produto, carregar:

- dados do produto;
- cores de `product_colors`;
- imagens por cor;
- tamanhos e estoques de `product_variations`;
- status de produto, cor e variacao.

Permitir:

- adicionar nova cor;
- trocar imagem de uma cor;
- adicionar novos tamanhos;
- criar novas combinacoes.

Nao permitir:

- exclusao fisica de cor;
- exclusao fisica de variacao;
- remocao automatica de variacoes existentes.

Se uma cor ou variacao precisar sair da operacao, deve ser inativada.

## Impacto em RLS e views

Sera necessario revisar:

- policies de `product_colors`;
- grants de `product_colors`;
- `vw_products_seller`;
- `vw_stock_seller`;
- futuras views de catalogo/site;
- funcoes controladas de vendas, pedidos e estoque.

Diretriz:

- Admin pode criar, editar e inativar cores.
- Seller pode visualizar cores ativas sem custo.
- Site futuro deve consumir apenas produtos, cores e variacoes ativas.

## Impacto em funcoes futuras

Funcoes de venda, pedido e estoque devem passar a usar:

```text
variation_id -> product_variations -> product_color_id -> product_colors
```

Isso permite recuperar:

- produto;
- cor;
- imagem da cor;
- tamanho;
- estoque.

## Preparacao para modulos futuros

### Estoque

O modulo Estoque podera exibir:

```text
Produto
└── Cor com imagem
    └── Tamanhos e quantidades
```

Ajustes, entradas e saidas continuam acontecendo em `product_variations`, mas agrupadas visualmente por `product_colors`.

### Catalogo Online

O catalogo podera mostrar:

- produto;
- cores disponiveis;
- imagem por cor;
- tamanhos disponiveis por cor;
- estoque disponivel por tamanho.

### Pedidos Online

O pedido podera gravar `variation_id`, mantendo rastreabilidade ate:

- produto;
- cor escolhida;
- imagem da cor;
- tamanho escolhido.

### Site futuro

O site podera implementar a experiencia:

1. Cliente abre produto.
2. Cliente seleciona cor.
3. Site exibe `product_colors.image_url`.
4. Cliente escolhe tamanho disponivel.
5. Pedido usa a variacao correta.

Sem duplicar imagem por tamanho e sem mudar arquitetura futuramente.

## Ordem recomendada antes de implementar frontend

1. Revisar `database/sql/006_product_colors_refactor.sql`.
2. Aprovar a migracao.
3. Executar SQL manualmente no Supabase.
4. Verificar queries finais do arquivo 006.
5. Atualizar frontend para usar `product_colors`.
6. Atualizar listagem agrupada e expansivel.
7. Somente depois iniciar modulo Estoque.

## SQL de migracao criado para revisao

Arquivo:

```text
database/sql/006_product_colors_refactor.sql
```

Conteudo planejado:

- cria `product_colors`;
- adiciona `product_variations.product_color_id` nullable;
- migra cores atuais de `product_variations.color`;
- preenche `product_color_id`;
- mantem `product_variations.color` temporariamente;
- nao aplica `not null` em `product_color_id` ainda;
- configura RLS de `product_colors`;
- atualiza `vw_products_seller` e `vw_stock_seller`;
- inclui queries finais de verificacao.
