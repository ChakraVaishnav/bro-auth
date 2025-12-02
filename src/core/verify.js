import jwt from "jsonwebtoken";

// Safe constant-time comparison (works in Node + Browser)
function safeCompare(a = "", b = "") {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

// ---------------------------
// VERIFY ACCESS TOKEN
// ---------------------------
export function verifyAccessToken(token, fpHash, secret) {
  try {
    const decoded = jwt.verify(token, secret);

    // Token must be type=access
    if (decoded.type !== "access") {
      return { valid: false, error: "Invalid token type" };
    }

    // Fingerprint binding check
    if (!safeCompare(decoded.fp, fpHash)) {
      return { valid: false, error: "Fingerprint mismatch" };
    }

    return { valid: true, payload: decoded };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

// ---------------------------
// VERIFY REFRESH TOKEN
// ---------------------------
export function verifyRefreshToken(token, fpHash, secret) {
  try {
    const decoded = jwt.verify(token, secret);

    // Token must be type=refresh
    if (decoded.type !== "refresh") {
      return { valid: false, error: "Invalid token type" };
    }

    // Fingerprint binding check
    if (!safeCompare(decoded.fp, fpHash)) {
      return { valid: false, error: "Fingerprint mismatch" };
    }

    return { valid: true, payload: decoded };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}
