import { renderDashboard } from './modules/dashboard.js';
import { renderCustomers } from './modules/customers.js';
import { renderProducts } from './modules/products.js';
import { renderNewSale, renderSales } from './modules/sales.js';
import { renderOrders } from './modules/orders.js';
import { renderFinance } from './modules/finance.js';
import { renderStock } from './modules/stock.js';
import { renderReports } from './modules/reports.js';
import { renderAudit } from './modules/audit.js';
import { renderSettings } from './modules/settings.js';

export const routes = {
  dashboard: {
    title: 'Dashboard',
    label: 'Dashboard',
    description: 'Visão geral reservada para indicadores e atalhos operacionais da Veste Bem.',
    render: renderDashboard,
  },
  produtos: {
    title: 'Produtos',
    label: 'Produtos',
    description: 'Cadastro e acompanhamento dos produtos da Veste Bem.',
    render: renderProducts,
  },
  estoque: {
    title: 'Estoque',
    label: 'Estoque',
    description: 'Consulta e movimentação de estoque por produto, cor e tamanho.',
    render: renderStock,
  },
  clientes: {
    title: 'Clientes',
    label: 'Clientes',
    description: 'Estrutura base para relacionamento e consulta de clientes.',
    render: renderCustomers,
  },
  vendas: {
    title: 'Vendas',
    label: 'Vendas',
    description: 'Estrutura base para acompanhamento comercial.',
    render: renderSales,
  },
  'vendas/nova': {
    title: 'Nova Venda',
    label: 'Vendas',
    description: 'Selecione o cliente e adicione os produtos à venda.',
    render: renderNewSale,
  },
  pedidos: {
    title: 'Pedidos',
    label: 'Pedidos',
    description: 'Acompanhe pedidos online, pagamentos, envios e entregas.',
    render: renderOrders,
  },
  financeiro: {
    title: 'Financeiro',
    label: 'Financeiro',
    description: 'Controle de receitas, despesas e saldo da loja.',
    adminOnly: true,
    render: renderFinance,
  },
  relatorios: {
    title: 'Relatórios',
    label: 'Relatórios',
    description: 'Estrutura base para consultas e análises futuras.',
    render: renderReports,
  },
  auditoria: {
    title: 'Auditoria',
    label: 'Auditoria',
    description: 'Área reservada para rastreabilidade administrativa.',
    adminOnly: true,
    render: renderAudit,
  },
  configuracoes: {
    title: 'Configurações',
    label: 'Configurações',
    description: 'Estrutura base para preferências e parâmetros do painel.',
    adminOnly: true,
    render: renderSettings,
  },
};

const defaultRoute = 'dashboard';

function getRouteFromHash() {
  return window.location.hash.replace(/^#\//, '').split('?')[0] || defaultRoute;
}

function setActiveLink(routeName) {
  document.querySelectorAll('[data-route-link]').forEach((link) => {
    const activeRoute = routeName.startsWith('vendas/') ? 'vendas' : routeName;
    link.classList.toggle('is-active', link.dataset.routeLink === activeRoute);
  });
}

function redirectToDefaultRoute() {
  window.location.hash = `#/${defaultRoute}`;
}

function canAccessRoute(route, profile) {
  return !route.adminOnly || profile?.role === 'admin';
}

function renderRoute(routeName, profile) {
  const main = document.querySelector('#app-main');
  const pageTitle = document.querySelector('#page-title');
  const pageSubtitle = document.querySelector('#page-subtitle');
  const topbar = document.querySelector('.topbar');
  const topbarTitle = document.querySelector('.topbar__title');
  const topbarBrandLogo = document.querySelector('[data-topbar-brand-logo]');
  const route = routes[routeName] || routes[defaultRoute];

  if (!canAccessRoute(route, profile)) {
    redirectToDefaultRoute();
    return;
  }

  pageTitle.textContent = routeName === 'dashboard' ? 'Dashboard' : route.title;
  if (topbar) topbar.hidden = false;
  topbarTitle?.classList.toggle('topbar__title--hidden', false);
  if (topbarBrandLogo) {
    topbarBrandLogo.hidden = routeName !== 'dashboard';
  }
  if (pageSubtitle) {
    pageSubtitle.textContent = routeName === 'dashboard' ? 'Resumo da operação de hoje.' : route.description;
  }
  document.title = `${route.title} - Veste Bem Admin`;
  setActiveLink(routeName);
  route.render(main, route, { profile, routeName });
  main.focus({ preventScroll: true });
}

export function initRouter(profile) {
  function handleRouteChange() {
    const requestedRouteName = getRouteFromHash();
    const routeName = routes[requestedRouteName] ? requestedRouteName : defaultRoute;

    if (routeName !== requestedRouteName) {
      redirectToDefaultRoute();
      return;
    }

    renderRoute(routeName, profile);
  }

  window.addEventListener('hashchange', handleRouteChange);

  if (!window.location.hash) {
    redirectToDefaultRoute();
    return;
  }

  handleRouteChange();
}
