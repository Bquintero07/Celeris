import { randomInt } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids ambiguous chars

/** CSPRNG-backed org join code, e.g. "K7F3M-9XQRT". */
export function genJoinCode(): string {
  let code = "";
  for (let i = 0; i < 10; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}
