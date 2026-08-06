export function renderModulePlaceholder(container, route) {
  container.innerHTML = `
    <section class="module-panel" aria-labelledby="module-title">
      <p class="eyebrow">${route.label}</p>
      <h2 id="module-title">${route.title}</h2>
      <p class="module-panel__text">${route.description}</p>
      <div class="status-grid" aria-label="Resumo estrutural">
        <article class="status-card">
          <span>Status</span>
          <strong>Base pronta</strong>
        </article>
        <article class="status-card">
          <span>Módulo</span>
          <strong>Sem CRUD</strong>
        </article>
        <article class="status-card">
          <span>Dados</span>
          <strong>Não alterados</strong>
        </article>
      </div>
    </section>
  `;
}
