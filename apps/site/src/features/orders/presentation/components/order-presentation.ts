const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "long",
});

export function formatOrderDate(value: Date | string) {
  return dateFormatter.format(new Date(value));
}

export function formatOrderTime(value: Date | string) {
  return timeFormatter.format(new Date(value));
}

export function formatOrderWeekday(value: Date | string) {
  const weekday = weekdayFormatter.format(new Date(value));
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

export function getEstimatedDeliveryDate(
  createdAt: string,
  deliveryEstimate: string,
) {
  const days = deliveryEstimate.match(/\d+/g)?.map(Number) ?? [5];
  const date = new Date(createdAt);
  let remaining = Math.max(...days);

  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }

  return date;
}
