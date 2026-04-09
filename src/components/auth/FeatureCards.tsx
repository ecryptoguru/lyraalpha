export interface FeatureItem {
  label: string;
  detail: string;
}

export function FeatureCards({ items }: { items: FeatureItem[] }) {
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-3xl border border-white/10 bg-background/60 p-4"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {item.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground/85">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}
