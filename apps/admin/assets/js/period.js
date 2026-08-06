const PERIOD_LABELS = {
  today: 'Hoje',
  week: 'Semana',
  month: 'Mês',
};

function localKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

export function getPeriodRange(value = 'today', now = new Date()) {
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from = current;
  let to = current;
  if (value === 'week') {
    from = startOfWeek(current);
    to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6);
  } else if (value === 'month') {
    from = new Date(current.getFullYear(), current.getMonth(), 1);
    to = new Date(current.getFullYear(), current.getMonth() + 1, 0);
  }
  return { value, from, to, dateFrom: localKey(from), dateTo: localKey(to), label: formatPeriodRange(value, from, to) };
}

export function formatPeriodRange(value, from, to) {
  if (value === 'today') return from.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  if (value === 'month') return from.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const first = from.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const last = to.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${first} a ${last}`;
}

export function renderPeriodSegmentedControl({ value = 'today', options = ['today', 'week', 'month'], id = 'period' } = {}) {
  const range = getPeriodRange(value);
  return `<div class="period-control-group" data-period-control="${id}"><div class="period-segmented" role="tablist" aria-label="Selecionar período">${options.map((item) => `<button type="button" role="tab" aria-selected="${item === value}" class="${item === value ? 'is-active' : ''}" data-period-value="${item}">${PERIOD_LABELS[item] || item}</button>`).join('')}</div><span class="period-range" data-period-range>${range.label}</span></div>`;
}

export function bindPeriodSegmentedControl(container, { id = 'period', value = 'today', onChange } = {}) {
  const root = container.querySelector(`[data-period-control="${id}"]`);
  if (!root) return;
  let current = value;
  const update = (next) => {
    current = next;
    const range = getPeriodRange(current);
    root.querySelectorAll('[data-period-value]').forEach((button) => {
      const active = button.dataset.periodValue === current;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    root.querySelector('[data-period-range]').textContent = range.label;
    onChange?.(range);
  };
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-period-value]');
    if (button) update(button.dataset.periodValue);
  });
  root.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) return;
    const buttons = [...root.querySelectorAll('[data-period-value]')];
    const index = buttons.findIndex((button) => button.dataset.periodValue === current);
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); update(current); return; }
    event.preventDefault();
    update(buttons[(index + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length].dataset.periodValue);
  });
}
