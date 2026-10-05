import { describe, expect, it } from "vitest";
import { homePathFor } from "./index";

describe("homePathFor", () => {
  it.each([
    ["member", "/club"],
    ["employee", "/operacion"],
    ["admin", "/admin"],
  ] as const)("envía %s a %s", (role, expectedPath) => {
    expect(homePathFor(role)).toBe(expectedPath);
  });
});

import { STAFF_PERMISSIONS } from "./index";
it("el administrador hereda operación y el empleado no administra", () => {
  for (const permission of STAFF_PERMISSIONS.employee)
    expect(STAFF_PERMISSIONS.admin).toContain(permission);
  for (const restricted of [
    "sales.void",
    "inventory.adjust",
    "products.manage",
    "users.manage",
    "backups.manage",
  ]) {
    expect(STAFF_PERMISSIONS.employee).not.toContain(restricted);
    expect(STAFF_PERMISSIONS.admin).toContain(restricted);
  }
});
