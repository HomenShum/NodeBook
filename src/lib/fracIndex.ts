// Some parts lifted from https://github.com/ulid/javascript/blob/master/lib/index.ts
import { generateNKeysBetween } from "fractional-indexing";

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford's Base32
const ENCODING_LEN = ENCODING.length;
const TIME_MAX = Math.pow(2, 48) - 1;
const TIME_LEN = 10;
const RANDOM_LEN = 4;

/**
 * Encode time as string which sorts from newest to oldest
 */
function encodeTime(now: number): string {
  if (isNaN(now)) {
    throw new Error(now + " must be a number");
  }
  if (now > TIME_MAX) {
    throw new Error("cannot encode time greater than " + TIME_MAX);
  }
  if (now < 0) {
    throw new Error("time must be positive");
  }
  if (Number.isInteger(now) === false) {
    throw new Error("time must be an integer");
  }

  // Invert the timestamp to reverse the sorting order
  now = TIME_MAX - now;

  let mod: number;
  let str = "";
  for (let i = TIME_LEN; i > 0; i--) {
    mod = now % ENCODING_LEN;
    str = ENCODING.charAt(mod) + str;
    now = (now - mod) / ENCODING_LEN;
  }
  return str;
}

function encodeRandom(): string {
  let str = "";
  for (let i = 0; i < RANDOM_LEN; i++) {
    str = randomChar() + str;
  }
  return str;
}

function randomChar(): string {
  let rand = Math.floor(Math.random() * ENCODING_LEN);
  if (rand === ENCODING_LEN) {
    rand = ENCODING_LEN - 1;
  }
  return ENCODING.charAt(rand);
}

export function parseIndex(a: string): [string, string, string] {
  const parts = a.split("-");
  if (parts.length !== 3) {
    throw new Error("Index should have 3 dash separated parts");
  }
  if (parts[0].length !== TIME_LEN) {
    throw new Error("Time part should have length " + TIME_LEN);
  }
  if (parts[2].length !== RANDOM_LEN) {
    throw new Error("Random part should have length " + RANDOM_LEN);
  }
  // TODO: the fractional part will start with "a" no matter what encoding string you give generateNKeysBetween
  // so we can't do this check
  // parts[1].split("").forEach((c) => {
  //   if (!ENCODING.includes(c)) {
  //     throw new Error("Invalid character in key: " + c);
  //   }
  // });
  return [parts[0], parts[1], parts[2]];
}

/**
 * Generate N lexically sortable index strings between a and b. See {@link generateIndex} for the format.
 *
 * @example
 * const ids = [
 *  "7YDX6T3S0H-a0-4929",
 *  "7YDX6T3S0H-a1-296Z"
 * ];
 * ids.push(...generateNIndexBetween(ids[0], ids[1], 2));
 * ids.sort();
 * assert(idsBetween[0] === "7YDX6T3S0H-a0-4929");
 * assert(idsBetween[1].startsWith("7YDX6T3S0H-a08-"));
 * assert(idsBetween[2].startsWith("7YDX6T3S0H-a0G-"));
 * assert(idsBetween[3] === "7YDX6T3S0H-a1-296Z");
 */
export function generateNIndex(n: number = 1, a: string | null = null, b: string | null = null): string[] {
  if (a !== null && b !== null && a >= b) {
    throw new Error("a must be less than b");
  }
  let timePart: string;
  let fracBefore: string | null = null;
  let fracAfter: string | null = null;
  let partsA: string[] = [];
  if (a !== null) {
    partsA = parseIndex(a);
    timePart = partsA[0];
    fracBefore = partsA[1];
  } else {
    timePart = encodeTime(Date.now());
  }
  // If there's a b and it's first part is the same, then we can use the fractional part. Otherwise
  // we don't need it, because everything generated after a will always be before b.
  if (b !== null) {
    const partsB = parseIndex(b);
    if (partsA[0] === partsB[0] && partsA[1] < partsB[1]) {
      fracAfter = partsB[1];
    }
  }
  return generateNKeysBetween(fracBefore, fracAfter, n, ENCODING).map((frac) =>
    [timePart, frac, encodeRandom()].join("-"),
  );
}

/**
 * Generates a lexically sortable index string. The index is composed of three parts:
 * - a 10 character time part which sorts from newest to oldest
 * - a N character fractional-index part
 * - some random characters
 *
 * @example
 * const id = generateIndex();
 * // id is a string like "7YDX6XMVQS-a0-TD28"
 * const parts = id.split("-");
 * assert(parts.length === 3);
 * assert(parts[1] === "a0")
 */
export function generateIndex(): string {
  return generateNIndex(1)[0];
}

async function main() {
  const ids = generateNIndex(2);
  ids.forEach((id) => console.log(id));
  console.log("----");
  const idsBetween = generateNIndex(2, ids[0], ids[1]);
  ids.push(...idsBetween);
  ids.sort();
  ids.forEach((id) => console.log(id));
}
// main().then(() => console.log("done"));
