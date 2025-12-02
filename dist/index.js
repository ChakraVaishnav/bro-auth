// src/core/fingerprint.js
import { SHA256 } from "crypto-es";
function generateFingerprintHash(rawString) {
  return SHA256(rawString).toString();
}

// src/core/tokens.js
import jwt from "jsonwebtoken";
function generateAccessToken(userId, fpHash, secret, expiresIn = "15m") {
  return jwt.sign(
    {
      sub: userId,
      fp: fpHash,
      type: "access"
    },
    secret,
    { expiresIn }
  );
}
function generateRefreshToken(userId, fpHash, secret, expiresIn = "7d") {
  return jwt.sign(
    {
      sub: userId,
      fp: fpHash,
      type: "refresh"
    },
    secret,
    { expiresIn }
  );
}
function generateTokens(userId, fpHash, accessSecret, refreshSecret) {
  const accessToken = generateAccessToken(userId, fpHash, accessSecret);
  const refreshToken = generateRefreshToken(userId, fpHash, refreshSecret);
  return { accessToken, refreshToken };
}

// src/core/verify.js
import jwt2 from "jsonwebtoken";
function safeCompare(a = "", b = "") {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
function verifyAccessToken(token, fpHash, secret) {
  try {
    const decoded = jwt2.verify(token, secret);
    if (decoded.type !== "access") {
      return { valid: false, error: "Invalid token type" };
    }
    if (!safeCompare(decoded.fp, fpHash)) {
      return { valid: false, error: "Fingerprint mismatch" };
    }
    return { valid: true, payload: decoded };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}
function verifyRefreshToken(token, fpHash, secret) {
  try {
    const decoded = jwt2.verify(token, secret);
    if (decoded.type !== "refresh") {
      return { valid: false, error: "Invalid token type" };
    }
    if (!safeCompare(decoded.fp, fpHash)) {
      return { valid: false, error: "Fingerprint mismatch" };
    }
    return { valid: true, payload: decoded };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

// src/core/cookies.js
function buildRefreshCookie(token, maxAge = 60 * 60 * 24 * 7) {
  return {
    name: "bro_refresh",
    value: token,
    options: {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge
    }
  };
}
function buildClearRefreshCookie() {
  return {
    name: "bro_refresh",
    value: "",
    options: {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0
    }
  };
}
export {
  buildClearRefreshCookie,
  buildRefreshCookie,
  generateAccessToken,
  generateFingerprintHash,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken
};
