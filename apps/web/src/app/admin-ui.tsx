import type { ReactNode } from "react";
import { RamaxIcon } from "./brand-ui";

const today = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/San_Luis",
});

export function AdminHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="admin-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="admin-heading__place">
        <RamaxIcon name="location" size={22} />
        <span><strong>San Luis</strong><small>{today.format(new Date())}</small></span>
      </div>
    </header>
  );
}

export function AdminCard({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`admin-card ${className}`.trim()}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

export function AdminSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="admin-search">
      <RamaxIcon name="search" size={23} />
      <span className="sr-only">{placeholder}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function productImageFor(name: string): string | undefined {
  const normalized = name.toLocaleLowerCase("es-AR");
  if (normalized.includes("cappuccino")) return "/assets/cappuccino-ramax.png";
  if (normalized.includes("medialuna")) return "/assets/medialuna-cafe.png";
  return undefined;
}
