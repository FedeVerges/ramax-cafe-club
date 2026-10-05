import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { CloseSaleDto } from "./close-sale.dto";
import { VoidSaleDto } from "./void-sale.dto";
import { AdjustInventoryDto } from "../../inventory/dto/adjust-inventory.dto";
describe("contratos de operación", () => {
  const item = {
    productId: "55e0d954-f668-4dcc-8a70-99b3e46be39b",
    quantity: 1,
  };
  it("exige pago admitido, total entero y cantidades positivas", async () => {
    for (const paymentMethod of [undefined, "card", "mercado_pago", "other"])
      expect(
        (
          await validate(
            plainToInstance(CloseSaleDto, {
              items: [item],
              paymentMethod,
              expectedTotalArs: 100,
            }),
          )
        ).length,
      ).toBeGreaterThan(0);
    expect(
      await validate(
        plainToInstance(CloseSaleDto, {
          items: [item],
          paymentMethod: "cash",
          expectedTotalArs: 100,
        }),
      ),
    ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(CloseSaleDto, {
            items: [{ ...item, quantity: 0.5 }],
            paymentMethod: "cash",
            expectedTotalArs: 100.5,
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it("no acepta motivo vacío, ajuste cero o anulación sin devolución", async () => {
    expect(
      (
        await validate(
          plainToInstance(VoidSaleDto, {
            reason: "   ",
            refundConfirmed: true,
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(VoidSaleDto, {
            reason: "Error",
            refundConfirmed: false,
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(AdjustInventoryDto, {
            productId: item.productId,
            delta: 0,
            reason: "Merma",
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
