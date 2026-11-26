import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-2.5 flex items-center gap-2">{eyebrow}</div>}
        <h1 className="font-display text-[30px] font-bold leading-[0.98] tracking-[-0.045em] text-chalk md:text-[40px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-mist md:text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className,
  as: As = "div",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  id?: string;
}) {
  return <As id={id} className={cn("surface relative overflow-hidden rounded-2xl", className)}>{children}</As>;
}

export function CardHeader({
  label,
  title,
  action,
  className,
}: {
  label?: React.ReactNode;
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {label && <p className="label-mono mb-1.5">{label}</p>}
        {title && <h3 className="font-display text-[19px] font-bold leading-none tracking-[-0.03em] text-chalk">{title}</h3>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
