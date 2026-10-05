import type { Request } from "express";

export type AuthUser = {
  id: string;
  displayName: string;
  username: string;
  roles: Array<"employee" | "admin">;
  permissions: string[];
  primaryRole: "employee" | "admin";
};

export type AuthenticatedRequest = Request & { ramaxUser?: AuthUser };
