import type { AuthenticatedSession } from "@ramax/contracts";
import { useOutletContext } from "react-router-dom";
export function useStaff() {
  return useOutletContext<AuthenticatedSession>();
}
