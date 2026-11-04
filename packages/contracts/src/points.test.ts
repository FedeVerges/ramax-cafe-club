import { describe, expect, it } from "vitest";
import { calculatePoints, isMemberNumber } from "./points";

describe("regla de puntos", () => {
  it("usa pesos enteros y redondea hacia abajo", () => {
    expect(calculatePoints(11_500, 100)).toBe(115);
    expect(calculatePoints(999, 1_000)).toBe(0);
    expect(calculatePoints(0, 100)).toBe(0);
  });

  it("rechaza importes y reglas que no se pueden representar con seguridad", () => {
    expect(() => calculatePoints(1.5, 100)).toThrow(RangeError);
    expect(() => calculatePoints(-1, 100)).toThrow(RangeError);
    expect(() => calculatePoints(100, 0)).toThrow(RangeError);
    expect(() => calculatePoints(Number.MAX_SAFE_INTEGER + 1, 100)).toThrow(RangeError);
  });

  it("acepta ceros iniciales en el número de socio", () => {
    expect(isMemberNumber("004281")).toBe(true);
    expect(isMemberNumber("4281")).toBe(false);
    expect(isMemberNumber("00428x")).toBe(false);
  });
});
