import "server-only";
import { randomInt } from "crypto";

/**
 * Generate a valid Nuki keypad PIN code.
 *
 * Nuki constraints:
 * - 6 digits
 * - Only digits 1-9 (no zeros)
 * - Cannot start with "12"
 * - Must be unique per smartlock
 *
 * @param existingCodes Set of codes already in use on the smartlock
 */
export function generatePin(existingCodes: Set<number>): number {
  const MAX_ATTEMPTS = 1000;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    let code = 0;
    for (let d = 0; d < 6; d++) {
      // Cryptographically secure random digit 1-9
      const digit = randomInt(1, 10);
      code = code * 10 + digit;
    }

    // Must not start with "12"
    const codeStr = String(code);
    if (codeStr.startsWith("12")) continue;

    // Must be unique
    if (existingCodes.has(code)) continue;

    return code;
  }

  throw new Error("Failed to generate unique PIN after maximum attempts");
}
