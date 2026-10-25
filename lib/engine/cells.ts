// Cell computation (spec 5.4). A1 = STUB: signature frozen (K2), returns an empty Cells. A3 implements.
import type { CellDef, Channel, Confirmation, FnCode, FunctionPiece, Mode, Region, Tri } from "../types";

/** Function bitmasks (bit i = FN_CODES[i]): y = cell Y, u = cell U (not Y). Possible = y | u. */
export interface FnMasks { y: number; u: number }

/** Per (resource, point, mode) entry: OR over channels, plus per-channel masks for representative channel. */
export interface ResPointCell extends FnMasks {
  byChannel: Partial<Record<Channel, FnMasks>>;
}

export interface Cells {
  /** Confirmation-cell registry: cellKey -> definition (spec 5.6). */
  registry: Map<string, CellDef>;
  /** Effective value of each registered cell (confirmation if accepted, else default U). */
  values: Map<string, Tri>;
  /** Confirmations actually applied (demo values on realNamed cells are dropped). */
  applied: Confirmation[];
  /** Confirmations ignored at entry (e.g. "시연 입력값" on realNamed cell), with reason. */
  ignored: { conf: Confirmation; reason: string }[];
  /** masks[mode].get(pointId).get(resId) — only non-zero entries are stored. */
  masks: Record<Mode, Map<string, Map<string, ResPointCell>>>;
  /** Impact index: cellKey -> set of "villageId|mode" it touches (incremental recompute). */
  affects: Map<string, Set<string>>;
  /** Travel burden in km (visit/hub/hubdrop: road estimate, tour: nearest stop, deliver: 0). */
  burden: (resId: string, pointId: string, mode: Mode) => number;
  /** Enabled function pieces and derived lookup tables. */
  fns: FunctionPiece[];
  enabledMask: number;
  /** Enabled core (non-social) functions mask. */
  coreMask: number;
  /** importance-sum lookup over core functions, length 1024 (index = mask). */
  weightTable: Float64Array;
  opts: { bus: boolean };
  /** true while this is the A1 stub. */
  stub?: boolean;
}

export function makeCells(
  region: Region,
  fns: FunctionPiece[],
  conf: Confirmation[],
  opts?: { bus?: boolean },
): Cells {
  void region;
  void conf;
  const enabled = fns.filter((f) => f.enabled);
  const empty = () => new Map<string, Map<string, ResPointCell>>();
  return {
    registry: new Map(),
    values: new Map(),
    applied: [],
    ignored: [],
    masks: { car: empty(), walk: empty(), homebound: empty() },
    affects: new Map(),
    burden: () => 0,
    fns: enabled,
    enabledMask: 0,
    coreMask: 0,
    weightTable: new Float64Array(1024),
    opts: { bus: opts?.bus ?? false },
    stub: true,
  };
}

/** Convenience: value of one registered cell (default U). */
export function cellValue(cells: Cells, key: string): Tri {
  return cells.values.get(key) ?? "U";
}

export type { FnCode };
