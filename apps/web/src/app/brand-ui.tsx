import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";
import { CoffeeBeanIcon } from "@phosphor-icons/react/dist/csr/CoffeeBean";
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House";
import { ChartBarIcon } from "@phosphor-icons/react/dist/csr/ChartBar";
import { PackageIcon } from "@phosphor-icons/react/dist/csr/Package";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { HardDrivesIcon } from "@phosphor-icons/react/dist/csr/HardDrives";
import { ReceiptIcon } from "@phosphor-icons/react/dist/csr/Receipt";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { GiftIcon } from "@phosphor-icons/react/dist/csr/Gift";
import { TicketIcon } from "@phosphor-icons/react/dist/csr/Ticket";
import { UserIcon } from "@phosphor-icons/react/dist/csr/User";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { ShoppingCartIcon } from "@phosphor-icons/react/dist/csr/ShoppingCart";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";

export const ramaxIcons = {
  home: HouseIcon,
  sales: ChartBarIcon,
  products: PackageIcon,
  people: UsersThreeIcon,
  backups: HardDrivesIcon,
  receipt: ReceiptIcon,
  next: ArrowRightIcon,
  points: StarIcon,
  rewards: GiftIcon,
  ticket: TicketIcon,
  account: UserIcon,
  search: MagnifyingGlassIcon,
  cart: ShoppingCartIcon,
  confirmed: CheckIcon,
} satisfies Record<string, Icon>;

export type RamaxIconName = keyof typeof ramaxIcons;

export function RamaxIcon({
  name,
  size = 20,
  weight = "regular",
  className,
}: {
  name: RamaxIconName;
  size?: number;
  weight?: "thin" | "light" | "regular" | "bold";
  className?: string;
}) {
  const IconComponent = ramaxIcons[name];
  return (
    <IconComponent
      size={size}
      weight={weight}
      className={className}
      aria-hidden="true"
      focusable="false"
    />
  );
}

export function RamaxBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`ramax-brand${compact ? " ramax-brand--compact" : ""}`}>
      <span className="ramax-brand__mark" aria-hidden="true">
        <CoffeeBeanIcon size={compact ? 22 : 28} weight="light" />
      </span>
      <span className="ramax-brand__wording">
        <span className="ramax-brand__name">RAMAX</span>
        {!compact && <small>COFFEE &amp; LUNCH</small>}
      </span>
    </div>
  );
}

export function BrandButton({
  variant = "primary",
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
}) {
  return (
    <button
      {...props}
      className={`button button--${variant} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

export function SurfaceCard({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`surface-card ${className}`.trim()} />;
}

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "accent";
  children: ReactNode;
}) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}

export function PointsProgress({
  points,
  target,
  caption,
}: {
  points: number;
  target: number;
  caption?: string;
}) {
  const progress = target > 0 ? Math.min(100, (points / target) * 100) : 0;
  return (
    <section className="points-progress" aria-label={`${points} puntos`}>
      <div className="points-progress__summary">
        <span className="points-progress__badge">
          <StarIcon size={20} weight="fill" aria-hidden="true" />
        </span>
        <strong>{points.toLocaleString("es-AR")}</strong>
        <span>puntos</span>
      </div>
      <div
        className="points-progress__track"
        role="progressbar"
        aria-label="Progreso hacia la próxima recompensa"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      {caption && <p>{caption}</p>}
    </section>
  );
}

export function ProductImage({
  src = "/assets/medialuna-cafe.png",
  alt = "Medialuna recién horneada con café",
}: {
  src?: string;
  alt?: string;
}) {
  return <img className="product-image" src={src} alt={alt} loading="lazy" />;
}
