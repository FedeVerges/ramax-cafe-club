import type { Request } from "express";

export type AuthUser = {
  id: string;
  displayName: string;
  email: string;
  roles: Array<"member" | "employee" | "admin">;
  permissions: string[];
  primaryRole: "member" | "employee" | "admin";
};

export type AuthenticatedRequest = Request & { ramaxUser?: AuthUser };
