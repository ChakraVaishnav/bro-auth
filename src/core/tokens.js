import jwt from "jsonwebtoken";

// Generate Access Token (short lived)
export function generateAccessToken(userId, fpHash, secret, expiresIn = "15m") {
  return jwt.sign(
    {
      sub: userId,
      fp: fpHash,
      type: "access",
    },
    secret,
    { expiresIn }
  );
}

// Generate Refresh Token (long lived)
export function generateRefreshToken(userId, fpHash, secret, expiresIn = "7d") {
  return jwt.sign(
    {
      sub: userId,
      fp: fpHash,
      type: "refresh",
    },
    secret,
    { expiresIn }
  );
}

// Generate both at once
export function generateTokens(userId, fpHash, accessSecret, refreshSecret) {
  const accessToken = generateAccessToken(userId, fpHash, accessSecret);
  const refreshToken = generateRefreshToken(userId, fpHash, refreshSecret);
  return { accessToken, refreshToken };
}
