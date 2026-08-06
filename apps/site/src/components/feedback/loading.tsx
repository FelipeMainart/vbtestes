type LoadingProps = Readonly<{
  label?: string;
}>;

export function Loading({ label = "Carregando" }: LoadingProps) {
  return (
    <div className="ds-loading" role="status">
      <span>{label}</span>
    </div>
  );
}
