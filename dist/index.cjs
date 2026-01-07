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
  generateRefreshToken: () => generateRefreshToken,
  generateTokens: () => generateTokens,
  verifyAccessToken: () => verifyAccessToken,
  verifyRefreshToken: () => verifyRefreshToken
});
module.exports = __toCommonJS(core_exports);

// src/core/tokens.js
var import_crypto = __toESM(require("crypto"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
function deriveSecret(secret, userId, fpHash) {
  const pepper = process.env.BRO_AUTH_SECRET_PEPPER;
  if (!pepper) {
    throw new Error("BRO_AUTH_SECRET_PEPPER is required");
  }
  return import_crypto.default.createHmac("sha256", pepper).update(`${secret}|${userId}|${fpHash}`).digest("hex");
}
function generateAccessToken(userId, fpHash, secret, expiresIn = "15m") {
  const derivedSecret = deriveSecret(secret, userId, fpHash);
  return import_jsonwebtoken.default.sign(
    {
      sub: userId,
      fp: fpHash,
      type: "access"
    },
    derivedSecret,
    { expiresIn }
  );
}
function generateRefreshToken(userId, fpHash, secret, expiresIn = "7d") {
  const derivedSecret = deriveSecret(secret, userId, fpHash);
  return import_jsonwebtoken.default.sign(
    {
      sub: userId,
      fp: fpHash,
      type: "refresh"
    },
    derivedSecret,
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
    const decodedUnsafe = import_jsonwebtoken2.default.decode(token);
    if (!decodedUnsafe || !decodedUnsafe.sub) {
      return { valid: false, error: "Invalid token structure" };
    }
    const derivedSecret = deriveSecret(secret, decodedUnsafe.sub, fpHash);
    const decoded = import_jsonwebtoken2.default.verify(token, derivedSecret);
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
    const decodedUnsafe = import_jsonwebtoken2.default.decode(token);
    if (!decodedUnsafe || !decodedUnsafe.sub) {
      return { valid: false, error: "Invalid token structure" };
    }
    const derivedSecret = deriveSecret(secret, decodedUnsafe.sub, fpHash);
    const decoded = import_jsonwebtoken2.default.verify(token, derivedSecret);
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
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken
});
