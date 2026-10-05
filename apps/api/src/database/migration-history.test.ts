import { expect, it } from "vitest";
import { LEGACY_LOCAL_HASHES, matchesMigrationHistory } from "./migration-history";

it("admite la cadena actual y el historial local completo preservado", () => {
  const expected = ["initial", "stock", "e01"];
  expect(matchesMigrationHistory(expected, expected)).toBe(true);
  expect(matchesMigrationHistory(["initial", "stock", ...LEGACY_LOCAL_HASHES, "e01"], expected)).toBe(true);
});

it("rechaza historiales incompletos, desconocidos, alterados o con migraciones pendientes", () => {
  const expected = ["initial", "stock", "e01"];
  for (const actual of [
    ["initial", "stock"],
    ["initial", "stock", "unknown", "e01"],
    ["initial", "stock", ...LEGACY_LOCAL_HASHES.slice(1), "e01"],
    ["initial", "stock", ...LEGACY_LOCAL_HASHES, "changed"],
    [...expected, "future"],
  ]) expect(matchesMigrationHistory(actual, expected)).toBe(false);
});
