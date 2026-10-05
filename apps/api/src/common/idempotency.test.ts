import { describe, expect, it } from "vitest";
import { requestHash, validateReplay } from "./idempotency";
describe("idempotencia", () => {
  it("normaliza orden de propiedades, pero distingue cantidades y pago", () => {
    expect(requestHash({ quantity: 1, method: "cash" })).toBe(
      requestHash({ method: "cash", quantity: 1 }),
    );
    expect(requestHash({ quantity: 1 })).not.toBe(requestHash({ quantity: 2 }));
    expect(requestHash({ method: "cash" })).not.toBe(
      requestHash({ method: "transfer" }),
    );
  });
  it("rechaza claves vencidas y pedidos distintos", () => {
    const stored = {
      requestHash: "abc",
      expiresAt: new Date(Date.now() + 60000),
    };
    expect(() => validateReplay(stored, "abc")).not.toThrow();
    expect(() => validateReplay(stored, "def")).toThrow("La clave ya se usó");
    expect(() =>
      validateReplay({ ...stored, expiresAt: new Date(0) }, "abc"),
    ).toThrow("La clave venció");
  });
});
