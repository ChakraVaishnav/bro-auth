# bro-auth

**Stateless JWT authentication with device fingerprint binding and derived signing keys.**

[![npm version](https://img.shields.io/npm/v/bro-auth.svg)](https://www.npmjs.com/package/bro-auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## Overview

`bro-auth` is a Node.js library that binds JWT tokens to browser devices using fingerprinting and derives signing keys from application-provided secrets. This prevents token replay attacks and limits the impact of token theft.

**What bro-auth does:**
- Generates and verifies JWT tokens bound to device fingerprints
- Derives unique signing secrets per user-device combination using HMAC
- Provides browser fingerprinting utilities

**What bro-auth does NOT do:**
- Manage secrets or environment variables (your application's responsibility)
- Prevent XSS attacks (your application's responsibility)
- Handle login UI or session management (your application's responsibility)

---

## Why Use bro-auth?

Traditional JWT tokens work from any device if stolen. `bro-auth` binds tokens to specific devices, making stolen tokens unusable on different browsers.

### Attack Mitigation

For an attacker to successfully use a stolen token, they would need:

1. The JWT token itself (stolen via XSS, network interception, etc.)
2. The user ID (embedded in token)
3. The application's access/refresh secrets
4. The exact device fingerprint hash (SHA-256)
5. The application's server-only pepper (`BRO_AUTH_SECRET_PEPPER`)

Even with items 1-4, the attacker cannot:
- Use the token from a different device (fingerprint mismatch fails verification)
- Forge new tokens (requires the server-only pepper)
- Replay the token (derived secret verification fails)

### Security Scope & Limitations

**What bro-auth protects against:**
- Token replay from different devices
- Token forgery without server secrets
- Credential stuffing across devices

**What bro-auth does NOT protect against:**
- XSS attacks during active execution (attacker can make requests while JS runs)
- Full server compromise (if secrets are leaked, all bets are off)
- Social engineering or phishing attacks
- Browser fingerprint spoofing (though difficult, it's theoretically possible)

**Your application must:**
- Implement XSS prevention (CSP, input sanitization, etc.)
- Store tokens securely (HTTP-only cookies for refresh tokens)
- Protect environment variables and secrets
- Use HTTPS in production

---

## Installation

```bash
npm install bro-auth
```

---

## How It Works

### 1. Authentication Flow

```
Browser                                    Server
  │
  ├─ Generate fingerprint hash
  │  (Canvas, GPU, User-Agent, etc.)
  │
  ├─ POST /login ────────────────────────▶ Verify credentials
  │  { username, password, fpHash }        │
  │                                        ├─ Derive signing secret:
  │                                        │  HMAC(pepper, secret|userId|fpHash)
  │                                        │
  │                                        ├─ Sign JWT with derived secret
  │                                        │  Payload: { sub: userId, fp: fpHash }
  │                                        │
  │  ◀──────────────────────────────────── Return tokens
  │  { accessToken, refreshToken }
  │
```

### 2. Verification Flow

```
Browser                                    Server
  │
  ├─ GET /api/protected ─────────────────▶ Extract token & fpHash
  │  Headers:                              │
  │    Authorization: Bearer <token>       ├─ Decode token (unsafe)
  │    X-Fingerprint: <fpHash>             │  Extract userId from payload
  │                                        │
  │                                        ├─ Re-derive signing secret:
  │                                        │  HMAC(pepper, secret|userId|fpHash)
  │                                        │
  │                                        ├─ Verify JWT signature
  │                                        │  jwt.verify(token, derivedSecret)
  │                                        │
  │                                        ├─ Compare fingerprints
  │                                        │  payload.fp === request.fpHash
  │                                        │
  │  ◀──────────────────────────────────── Grant access ✓
  │
```

### 3. Why Stolen Tokens Fail

```
Attacker (Different Device)                Server
  │
  ├─ GET /api/protected ─────────────────▶ Extract token & fpHash
  │  Token: <stolen_token>                 │
  │  Fingerprint: <attacker_fp_hash>       ├─ Decode token
  │                                        │  payload.fp = <victim_fp_hash>
  │                                        │
  │                                        ├─ Derive secret using attacker's FP:
  │                                        │  HMAC(pepper, secret|userId|attacker_fp)
  │                                        │
  │                                        ├─ Verify signature
  │                                        │  ✗ FAILS - Different derived secret
  │                                        │
  │  ◀──────────────────────────────────── Reject: "invalid signature"
  │
```

**Key insight:** The signing secret is derived from the fingerprint. A different fingerprint produces a different secret, causing signature verification to fail.

---

## Quick Start

### Step 1: Configure Environment Variables

Create a `.env` file in your application (NOT in bro-auth):

```bash
# Required: Application-owned server-only pepper
# bro-auth requires this but does NOT provide it
BRO_AUTH_SECRET_PEPPER=your-random-string-min-32-chars-never-expose

# Your application's JWT signing secrets
ACCESS_SECRET=your-access-secret-min-32-chars
REFRESH_SECRET=your-refresh-secret-min-32-chars
```

**Important:** These are YOUR application's secrets. `bro-auth` reads them but does not manage or provide them.

### Step 2: Browser - Generate Fingerprint

```javascript
import { getFingerprint } from "bro-auth/browser";

async function handleLogin() {
  // Generate device fingerprint hash
  const fpHash = await getFingerprint();
  
  // fpHash is a string: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "user@example.com",
      password: "password123",
      fingerprint: fpHash
    })
  });
  
  const { accessToken, refreshToken } = await response.json();
  
  // Store tokens (see security best practices)
  sessionStorage.setItem("accessToken", accessToken);
}
```

### Step 3: Server - Generate Tokens

```javascript
import { generateTokens } from "bro-auth/core";

app.post("/api/login", async (req, res) => {
  const { username, password, fingerprint } = req.body;
  
  // 1. Verify credentials (your logic)
  const user = await authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  // 2. Generate device-bound tokens
  const { accessToken, refreshToken } = generateTokens(
    user.id,                          // userId
    fingerprint,                      // fpHash from browser
    process.env.ACCESS_SECRET,        // your secret
    process.env.REFRESH_SECRET        // your secret
  );
  
  res.json({ accessToken, refreshToken });
});
```

### Step 4: Server - Verify Requests

```javascript
import { verifyAccessToken } from "bro-auth/core";

app.get("/api/protected", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const fingerprint = req.headers["x-fingerprint"];
  
  if (!token || !fingerprint) {
    return res.status(401).json({ error: "Missing credentials" });
  }
  
  const result = verifyAccessToken(
    token,
    fingerprint,
    process.env.ACCESS_SECRET
  );
  
  if (!result.valid) {
    return res.status(401).json({ error: result.error });
  }
  
  // Access granted
  const userId = result.payload.sub;
  res.json({ message: "Success", userId });
});
```

### Step 5: Server - Refresh Tokens

```javascript
import { verifyRefreshToken, generateTokens } from "bro-auth/core";

app.post("/api/refresh", (req, res) => {
  const { refreshToken, fingerprint } = req.body;
  
  const result = verifyRefreshToken(
    refreshToken,
    fingerprint,
    process.env.REFRESH_SECRET
  );
  
  if (!result.valid) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
  
  // Issue new token pair
  const tokens = generateTokens(
    result.payload.sub,
    fingerprint,
    process.env.ACCESS_SECRET,
    process.env.REFRESH_SECRET
  );
  
  res.json({ accessToken: tokens.accessToken });
});
```

---

## API Reference

### Browser Module (`bro-auth/browser`)

#### `getFingerprint()`

Generates a SHA-256 hash of browser device characteristics.

**Returns:** `Promise<string>`

**Example:**
```javascript
const fpHash = await getFingerprint();
// "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
```

---

### Server Module (`bro-auth/core`)

#### `generateTokens(userId, fpHash, accessSecret, refreshSecret)`

Generates access and refresh tokens bound to a device fingerprint.

**Parameters:**
- `userId` (string) - Unique user identifier
- `fpHash` (string) - Device fingerprint hash from browser
- `accessSecret` (string) - Your application's access token secret
- `refreshSecret` (string) - Your application's refresh token secret

**Returns:** `{ accessToken: string, refreshToken: string }`

**Example:**
```javascript
const tokens = generateTokens(
  "user_123",
  fpHash,
  process.env.ACCESS_SECRET,
  process.env.REFRESH_SECRET
);
```

---

#### `generateAccessToken(userId, fpHash, secret, expiresIn?)`

Generates only an access token.

**Parameters:**
- `userId` (string) - User identifier
- `fpHash` (string) - Fingerprint hash
- `secret` (string) - Signing secret
- `expiresIn` (string, optional) - Expiration time (default: "15m")

**Returns:** `string`

**Example:**
```javascript
const accessToken = generateAccessToken(
  "user_123",
  fpHash,
  process.env.ACCESS_SECRET,
  "30m"
);
```

---

#### `generateRefreshToken(userId, fpHash, secret, expiresIn?)`

Generates only a refresh token.

**Parameters:**
- `userId` (string) - User identifier
- `fpHash` (string) - Fingerprint hash
- `secret` (string) - Signing secret
- `expiresIn` (string, optional) - Expiration time (default: "7d")

**Returns:** `string`

---

#### `verifyAccessToken(token, fpHash, secret)`

Verifies an access token and fingerprint binding.

**Parameters:**
- `token` (string) - JWT access token
- `fpHash` (string) - Current device fingerprint hash
- `secret` (string) - Signing secret

**Returns:** `VerificationResult`

```typescript
{
  valid: boolean;
  payload?: {
    sub: string;      // userId
    fp: string;       // fingerprint hash
    type: string;     // "access"
    iat: number;      // issued at timestamp
    exp: number;      // expiration timestamp
  };
  error?: string;
}
```

**Possible errors:**
- `"Invalid token structure"` - Malformed JWT
- `"invalid signature"` - Token tampered or wrong fingerprint
- `"jwt expired"` - Token expired
- `"Invalid token type"` - Not an access token
- `"Fingerprint mismatch"` - Device fingerprint doesn't match

**Example:**
```javascript
const result = verifyAccessToken(token, fpHash, process.env.ACCESS_SECRET);

if (result.valid) {
  console.log("User ID:", result.payload.sub);
} else {
  console.error("Error:", result.error);
}
```

---

#### `verifyRefreshToken(token, fpHash, secret)`

Verifies a refresh token and fingerprint binding.

**Parameters:** Same as `verifyAccessToken`

**Returns:** `VerificationResult`

---

#### `buildRefreshCookie(refreshToken, options?)`

Generates a secure HTTP-only cookie string for refresh tokens.

**Parameters:**
- `refreshToken` (string) - The refresh token
- `options` (object, optional):
  - `maxAge` (number) - Cookie lifetime in seconds (default: 604800 = 7 days)
  - `domain` (string) - Cookie domain
  - `sameSite` ("Strict" | "Lax" | "None") - SameSite policy (default: "Strict")
  - `secure` (boolean) - HTTPS only (default: true)

**Returns:** `string` (Set-Cookie header value)

**Example:**
```javascript
const cookie = buildRefreshCookie(refreshToken, {
  maxAge: 86400,
  sameSite: "Strict",
  secure: true
});

res.setHeader("Set-Cookie", cookie);
```

---

#### `buildClearRefreshCookie()`

Generates a cookie string to clear the refresh token (for logout).

**Returns:** `string`

**Example:**
```javascript
app.post("/api/logout", (req, res) => {
  res.setHeader("Set-Cookie", buildClearRefreshCookie());
  res.json({ message: "Logged out" });
});
```

---

#### `deriveSecret(secret, userId, fpHash)`

Derives a unique signing secret using HMAC-SHA256 with the application's pepper.

**Parameters:**
- `secret` (string) - Base secret (access or refresh)
- `userId` (string) - User identifier
- `fpHash` (string) - Fingerprint hash

**Returns:** `string` (Hex-encoded derived secret)

**Note:** This is used internally. You typically don't need to call this directly.

---

## Security Best Practices

### 1. Environment Variables

Never hardcode secrets. Use environment variables:

```bash
# .env (add to .gitignore)
BRO_AUTH_SECRET_PEPPER=min-32-chars-random-string
ACCESS_SECRET=min-32-chars-random-string
REFRESH_SECRET=min-32-chars-random-string
```

Generate secrets using:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Token Storage

**Access tokens:**
- Store in memory (React state, Vue reactive)
- Session storage is acceptable for SPAs
- **Never** in localStorage (XSS vulnerable)

**Refresh tokens:**
- HTTP-only, Secure, SameSite=Strict cookies (recommended)
- **Never** accessible to JavaScript

**Example:**
```javascript
// ✓ Good: In-memory
const [accessToken, setAccessToken] = useState(null);

// ✗ Bad: localStorage
localStorage.setItem("token", accessToken); // XSS vulnerable
```

### 3. HTTPS Only

Always use HTTPS in production:

```javascript
const cookie = buildRefreshCookie(refreshToken, {
  secure: process.env.NODE_ENV === "production",
  sameSite: "Strict"
});
```

### 4. Short-Lived Access Tokens

Keep access token TTL short (5-15 minutes):

```javascript
generateAccessToken(userId, fpHash, secret, "15m");
```

### 5. Token Rotation

Rotate refresh tokens on each use:

```javascript
app.post("/api/refresh", async (req, res) => {
  const result = verifyRefreshToken(/* ... */);
  
  if (result.valid) {
    // Issue new token pair
    const newTokens = generateTokens(/* ... */);
    
    // Optional: Invalidate old refresh token in database
    await revokeToken(req.body.refreshToken);
    
    res.json(newTokens);
  }
});
```

### 6. Rate Limiting

Implement rate limiting on auth endpoints:

```javascript
import rateLimit from "express-rate-limit";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});

app.post("/api/login", loginLimiter, handleLogin);
```

---

## Framework Examples

### Express.js Middleware

```javascript
import { verifyAccessToken } from "bro-auth/core";

export const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const fingerprint = req.headers["x-fingerprint"];
  
  if (!token || !fingerprint) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const result = verifyAccessToken(
    token,
    fingerprint,
    process.env.ACCESS_SECRET
  );
  
  if (!result.valid) {
    return res.status(401).json({ error: result.error });
  }
  
  req.userId = result.payload.sub;
  next();
};

// Usage
app.get("/api/user", authMiddleware, (req, res) => {
  res.json({ userId: req.userId });
});
```

### Next.js 14 App Router

**Server Action:**
```typescript
// app/actions/auth.ts
'use server'

import { generateTokens } from "bro-auth/core";
import { cookies } from "next/headers";

export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const fingerprint = formData.get("fingerprint") as string;
  
  const user = await authenticateUser(username, password);
  if (!user) {
    return { error: "Invalid credentials" };
  }
  
  const tokens = generateTokens(
    user.id,
    fingerprint,
    process.env.ACCESS_SECRET!,
    process.env.REFRESH_SECRET!
  );
  
  cookies().set("refreshToken", tokens.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7
  });
  
  return { accessToken: tokens.accessToken };
}
```

**Client Component:**
```typescript
// app/login/page.tsx
'use client'

import { getFingerprint } from "bro-auth/browser";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    const fpHash = await getFingerprint();
    formData.append("fingerprint", fpHash);
    
    const result = await loginAction(formData);
    if (result.accessToken) {
      sessionStorage.setItem("accessToken", result.accessToken);
      router.push("/dashboard");
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <input name="username" type="email" required />
      <input name="password" type="password" required />
      <button type="submit">Login</button>
    </form>
  );
}
```

### React Auth Context

```javascript
import { createContext, useContext, useState, useEffect } from "react";
import { getFingerprint } from "bro-auth/browser";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [fingerprint, setFingerprint] = useState(null);
  
  useEffect(() => {
    getFingerprint().then(setFingerprint);
  }, []);
  
  async function login(username, password) {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, fingerprint })
    });
    
    const data = await response.json();
    setAccessToken(data.accessToken);
  }
  
  async function apiCall(endpoint, options = {}) {
    return fetch(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        "Authorization": `Bearer ${accessToken}`,
        "X-Fingerprint": fingerprint
      }
    });
  }
  
  return (
    <AuthContext.Provider value={{ login, apiCall, accessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

---

## FAQ

**Q: Can users have multiple devices?**

A: Yes. Each device generates its own fingerprint. Issue separate token pairs for each device. Optionally track active sessions by storing fingerprint hashes.

**Q: What if the fingerprint changes (browser update)?**

A: The user must re-authenticate. This is intentional—it prevents fingerprint spoofing. For better UX, implement a "trusted devices" feature or send email notifications for new logins.

**Q: What about privacy concerns?**

A: The fingerprint is SHA-256 hashed before transmission. Only the hash is sent to the server. However, disclose fingerprinting in your privacy policy and comply with GDPR/CCPA.

**Q: Does this work with mobile apps?**

A: The browser module is web-only. For mobile apps, use native device identifiers:
- iOS: `identifierForVendor`
- Android: `ANDROID_ID`
- React Native: `react-native-device-info`

**Q: How do I invalidate tokens immediately?**

A: `bro-auth` is stateless, so tokens can't be revoked until expiry. For immediate invalidation:
- Maintain a token blacklist in Redis
- Use short-lived access tokens (5-15 min)
- Implement token versioning (increment on password change)

**Q: Can I use this with GraphQL?**

A: Yes. Pass credentials in HTTP headers:

```javascript
const client = new ApolloClient({
  uri: '/graphql',
  request: async (operation) => {
    const fpHash = await getFingerprint();
    operation.setContext({
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-fingerprint': fpHash
      }
    });
  }
});
```

---

## Testing

### Run Backend Tests

```bash
npm test
```

Tests:
- Token generation
- Token verification
- Fingerprint binding
- Secret derivation
- Invalid fingerprint rejection

### Run Browser Tests

```bash
npx serve .
```

Open: `http://localhost:3000/tests/test-browser.html`

Tests:
- Fingerprint generation
- SHA-256 hashing
- Browser compatibility

---

## Contributing

Contributions welcome. Please:

1. Fork the repository
2. Create a feature branch
3. Run tests (`npm test`)
4. Submit a pull request

---

## License

MIT © Vaishnav

---

## Links

- [NPM Package](https://www.npmjs.com/package/bro-auth)
- [GitHub Repository](https://github.com/ChakraVaishnav/bro-auth)
- [Report Issues](https://github.com/ChakraVaishnav/bro-auth/issues)