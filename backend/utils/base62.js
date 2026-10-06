// Base62 = digits 0-9, uppercase A-Z, lowercase a-z  (10 + 26 + 26 = 62 characters)
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = 62n;   // the "n" means BigInt (safe for very large numbers)

// Turn a number into a base62 string, e.g. 125 -> "21" (125 = 2*62 + 1)
// padTo makes the result a fixed length by adding '0' at the front: "21" -> "000021"
function encodeBase62(num, padTo = 1) {
    let n = BigInt(num);
    let result = '';

    while (n > 0n) {
        const remainder = Number(n % BASE);       // which character is this digit?
        result = ALPHABET[remainder] + result;    // put it at the front
        n = n / BASE;                             // move to the next digit
    }

    return result.padStart(padTo, ALPHABET[0]);
}

// Turn a base62 string back into a number (useful for testing)
function decodeBase62(str) {
    let n = 0n;
    for (const char of str) {
        n = n * BASE + BigInt(ALPHABET.indexOf(char));
    }
    return n;
}

module.exports = { encodeBase62, decodeBase62 };