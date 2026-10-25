// K2 contract: engine functions are exported from here ONLY (spec 11.2). Signatures frozen at A1, implemented in A3.
//   makeCells(region, fns, conf, opts)
//   planScope(region, cells, store, fns)
//   computeVoi(region, cells, plan, store, fns)
//   personal(region, cells, pointId, mode, fns)
//   b1 / b1b / b1g(region, cells, villageId, mode, fns)
//   digestFor(region, plan, target, scenario, conf)
export { makeCells, cellValue, withOverrides, affectedVM } from "./cells";
export type { Cells, FnMasks, ResPointCell } from "./cells";
export { planScope, scopeOf, solveVM, vmFromSet } from "./cover";
export type { StoreLoc } from "./cover";
export { computeVoi } from "./voi";
export { personal } from "./personal";
export { b1, b1b, b1g } from "./baselines";
export { digestFor, daysFromNotes } from "./digest";
export type { DigestTarget } from "./digest";
export { triAnd, triOr } from "./tri";
export { P } from "./params";
export type { Params } from "./params";

/** true until A3 replaced the stubs. A3 done: real engine. */
export const ENGINE_STUB = false;
