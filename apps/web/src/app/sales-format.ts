const timeZone = "America/Argentina/San_Luis";
const dayFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone, day: "numeric", month: "long", year: "numeric",
});
const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone, day: "numeric", month: "short", year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
});
export const salesDay = (value: string) => dayFormatter.format(new Date(value));
export const salesTime = (value: string) => timeFormatter.format(new Date(value));
export const salesDate = (value: string) => `${dateFormatter.format(new Date(value))} · ${salesTime(value)}`;

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", maximumFractionDigits: 0,
});
export const salesMoney = (value: number) => moneyFormatter.format(value).replace(/\s/g, "");
