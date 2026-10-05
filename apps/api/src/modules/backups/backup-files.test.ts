import { expect, it } from "vitest";
import { businessDay } from "./backup-files";
it("usa el día de negocio incluso alrededor de medianoche UTC", () => {
  expect(businessDay(new Date("2026-10-05T02:59:00Z"))).toBe("2026-10-04");
  expect(businessDay(new Date("2026-10-05T03:00:00Z"))).toBe("2026-10-05");
});
