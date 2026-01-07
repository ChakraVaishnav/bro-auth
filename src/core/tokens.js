import crypto from "crypto";
import jwt from "jsonwebtoken";

export function deriveSecret(secret, userId, fpHash) {
  const pepper = process.env.BRO_AUTH_SECRET_PEPPER;
  if (!pepper) {
    throw new Error("BRO_AUTH_SECRET_PEPPER is required");
  }

  return crypto
    .createHmac("sha256", pepper)
    .update(`${secret}|${userId}|${fpHash}`)
    .digest("hex");
}

export function generateAccessToken(userId, fpHash, secret, expiresIn = "15m") {
  const derivedSecret = deriveSecret(secret, userId, fpHash);

  return jwt.sign(
    {
      sub: userId,
      fp: fpHash,
      type: "access",
    },
    derivedSecret,
    { expiresIn }
  );
}

export function generateRefreshToken(userId, fpHash, secret, expiresIn = "7d") {
  const derivedSecret = deriveSecret(secret, userId, fpHash);

  return jwt.sign(
    {
      sub: userId,
      fp: fpHash,
      type: "refresh",
    },
    derivedSecret,
    { expiresIn }
  );
}


// Generate both at once
export function generateTokens(userId, fpHash, accessSecret, refreshSecret) {
  const accessToken = generateAccessToken(userId, fpHash, accessSecret);
  const refreshToken = generateRefreshToken(userId, fpHash, refreshSecret);
  return { accessToken, refreshToken };
}
