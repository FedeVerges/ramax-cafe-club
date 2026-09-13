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
