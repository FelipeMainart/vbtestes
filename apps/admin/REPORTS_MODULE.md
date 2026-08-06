# Modulo Relatorios

## Estrutura

O modulo possui tres niveis internos, sem drawers:

1. Hub de Relatorios: categorias e ultimos relatorios exportados, sem indicadores ou periodo.
2. Categoria: lista os relatorios disponiveis.
3. Relatorio: breadcrumb, periodo, filtros, resumo, grafico e tabela.

As categorias sao Vendas, Produtos, Estoque, Clientes, Financeiro e Pedidos Online. Pedidos Online fica preparado para a integracao do e-commerce e apresenta os relatorios de status, envio, cancelamento, expiracao, tempos operacionais e faturamento.

## Periodo e dados

O modulo reutiliza `assets/js/period.js` somente no nivel de detalhe. Hoje, Semana e Mes atualizam os filtros de data compartilhados pelas consultas existentes; Ano e Personalizado estendem esse contexto apenas no relatorio aberto. A tela principal nao consulta indicadores, nao mostra graficos e nao possui filtro de periodo. Os dados carregados sao mantidos em cache por categoria para evitar consultas repetidas enquanto o usuario navega entre relatorios.

## Permissoes

Administradores veem todas as categorias e relatorios. Sellers veem somente Vendas e o relatorio Fechamento de Caixa, que usa as vendas do periodo para apresentar quantidade, valores e formas de pagamento sem expor relatorios financeiros.

## Exportacao

No detalhe, CSV usa os dados filtrados existentes. O botao Exportar gera PDF pelo `html2pdf` quando a biblioteca estiver disponivel; caso contrario, abre a impressao do navegador, que permite Salvar como PDF. O botao Imprimir usa a mesma pagina preparada por CSS de impressao.

## Recentes e favoritos

Os ultimos cinco relatórios exportados ficam registrados durante a sessao para download novamente. A colecao de favoritos possui estado reservado no modulo para uma futura interface de fixacao, sem alterar o fluxo atual.

## Integracoes futuras

Pedidos Online depende da integracao do e-commerce para tempos reais de separacao e envio. Margem por produto depende de custos confiaveis por produto/variacao. Esses relatorios possuem estrutura e navegacao prontas, mas devem receber consultas especializadas quando os dados estiverem disponiveis.
