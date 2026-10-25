// Phone number masking (spec 6.1). Runs on the client before sending and once more on the server.
export const PHONE_SOURCE = String.raw`0\d{1,2}[-. ]?\d{3,4}[-. ]?\d{4}`;
export const PHONE_MASK = "[전화번호 가림]";

/** Fresh global regex each call (a shared /g regex keeps lastIndex state). */
export const phoneRe = (flags = "g") => new RegExp(PHONE_SOURCE, flags);

export function redactPhones(s: string): string {
  return typeof s === "string" ? s.replace(phoneRe(), PHONE_MASK) : s;
}

export function hasPhone(s: string): boolean {
  return phoneRe("").test(s);
}
