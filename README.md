┌──────────────────────────────────────────────────────────────┐
│  █▄▄ █▀█ █▀█   ▄▀█ █░█ ▀█▀ █░█      bro-auth                │
│  █▄█ █▀▄ █▄█   █▀█ █▀█ ░█░ █▀█                              │
├──────────────────────────────────────────────────────────────┤
│     Stateless JWT · Device Fingerprinting · Zero Replay      │
└──────────────────────────────────────────────────────────────┘

# bro-auth
A lightweight, **stateless**, and **high-security** authentication layer using:

✅ JWT access tokens  
✅ Refresh tokens  
✅ Device fingerprint binding (prevents stolen-token replay)  
✅ No database required  

bro-auth aims to provide **DPoP-inspired protection** without the complexity.

---

## 🚀 Features

- 🔐 **Stateless JWT authentication**
- 🆔 **Device fingerprint binding** (SHA-256 hashed)
- 🚫 **Replay attack protection** (tokens tied to a specific browser)
- ⚡ Lightweight, zero dependencies except `jsonwebtoken` + `crypto-es`
- 🧩 Works with ANY backend (Next.js, Express, Node HTTP)
- 🌐 Browser module provided for fingerprint extraction
- 📦 Ready for NPM consumption

---

## 📦 Installation
npm install bro-auth
yarn add bro-auth

---

## 🧠 How it Works (Simple Explanation)

1️⃣ Client generates a **device fingerprint** using the browser module.  
2️⃣ Client sends that fingerprint to backend during login.  
3️⃣ Server issues JWT **access token** + **refresh token**, both bound to that fingerprint.  
4️⃣ On every request, server verifies:
- token signature  
- expiry  
- **fingerprint match**  

If an attacker steals the token and tries using another browser:

❌ The fingerprint mismatch blocks them.  
✔ User stays secure even without database.

---

# 🛜 Browser: Get Device Fingerprint

# Import from the browser bundle:

import { getFingerprint } from "bro-auth/browser";

async function run() {
  const fp = await getFingerprint();

  console.log("Fingerprint Hash:", fp.hash);
  console.log("Raw:", fp.raw);
  console.log("Components:", fp.components);

  // Send fp.hash to backend during login
}
run();


# Output example:

{
  "hash": "53ff76d8...2696",
  "raw": "UA|screen|gpu|canvas|...",
  "components": {
    "userAgent": "...",
    "gpu": "...",
    "canvas": "data:image/png;base64,..."
  }
}

# This hash must be sent to the server during login.


# 🔑 Server: Generate Tokens
import {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  generateFingerprintHash,
  buildRefreshCookie
} from "bro-auth";

Generate Access + Refresh Tokens
const ACCESS_SECRET = process.env.ACCESS_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

const { accessToken, refreshToken } = generateTokens({
  userId: "123",
  fingerprintHash,
  accessSecret: ACCESS_SECRET,
  refreshSecret: REFRESH_SECRET,
});

# 🧪 Verify Access Token
const result = verifyAccessToken(accessToken, fingerprintHash, ACCESS_SECRET);

if (!result.valid) {
  return { error: "Token invalid" };
}

console.log(result.payload.userId); // OK

# 🔄 Verify Refresh Token
const result = verifyRefreshToken(refreshToken, fingerprintHash, REFRESH_SECRET);

if (result.valid) {
  // Issue new tokens
}

# 🍪 Refresh Token Cookie Helper
const cookie = buildRefreshCookie(refreshToken);

// Set on response
res.setHeader("Set-Cookie", cookie);

