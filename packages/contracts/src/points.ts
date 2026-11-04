export function calculatePoints(totalArs: number, pesosPorPunto: number): number {
  if (
    !Number.isSafeInteger(totalArs) ||
    totalArs < 0 ||
    !Number.isSafeInteger(pesosPorPunto) ||
    pesosPorPunto <= 0
  ) {
    throw new RangeError("El importe y la regla de puntos deben ser enteros válidos.");
  }
  return Math.floor(totalArs / pesosPorPunto);
}

export function isMemberNumber(value: string): boolean {
  return /^[0-9]{6}$/.test(value);
}
