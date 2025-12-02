var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/core/index.js
var core_exports = {};
__export(core_exports, {
  buildClearRefreshCookie: () => buildClearRefreshCookie,
  buildRefreshCookie: () => buildRefreshCookie,
  generateAccessToken: () => generateAccessToken,
  generateFingerprintHash: () => generateFingerprintHash,
  generateRefreshToken: () => generateRefreshToken,
  generateTokens: () => generateTokens,
  verifyAccessToken: () => verifyAccessToken,
  verifyRefreshToken: () => verifyRefreshToken
});
module.exports = __toCommonJS(core_exports);

// src/core/fingerprint.js
var import_crypto_es = require("crypto-es");
function generateFingerprintHash(rawString) {
  return (0, import_crypto_es.SHA256)(rawString).toString();
}

// src/core/tokens.js
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
function generateAccessToken(userId, fpHash, secret, expiresIn = "15m") {
  return import_jsonwebtoken.default.sign(
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
  return import_jsonwebtoken.default.sign(
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
var import_jsonwebtoken2 = __toESM(require("jsonwebtoken"), 1);
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
    const decoded = import_jsonwebtoken2.default.verify(token, secret);
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
    const decoded = import_jsonwebtoken2.default.verify(token, secret);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildClearRefreshCookie,
  buildRefreshCookie,
  generateAccessToken,
  generateFingerprintHash,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken
});
