import type { Tri } from "../types";

// Three-valued logic (Kleene). Y > U > N.
const RANK: Record<Tri, number> = { N: 0, U: 1, Y: 2 };
const BY_RANK: Tri[] = ["N", "U", "Y"];

export function triAnd(...xs: Tri[]): Tri {
  let r = 2;
  for (const x of xs) r = Math.min(r, RANK[x]);
  return BY_RANK[r];
}

export function triOr(...xs: Tri[]): Tri {
  let r = 0;
  for (const x of xs) r = Math.max(r, RANK[x]);
  return BY_RANK[r];
}
