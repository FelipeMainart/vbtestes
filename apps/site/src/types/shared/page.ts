export type Page<TItem> = Readonly<{
  items: readonly TItem[];
  page: number;
  pageSize: number;
  total: number;
}>;
