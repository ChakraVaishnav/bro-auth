
# bro-auth

```
╔══════════════════════════════════════════════════════════════╗
║               █▄▄ █▀█ █▀█   █▀█ █ █ ▀█▀ █ █                  ║
║               █▄█ █▀▄ █▄█   █▀█ █▄█  █  █▀█                  ║
╠══════════════════════════════════════════════════════════════╣
║            Stateless JWT · Device Fingerprinting             ║
╚══════════════════════════════════════════════════════════════╝
```

**Stateless JWT authentication with browser fingerprint binding and derived signing keys.**


[![npm version](https://img.shields.io/npm/v/bro-auth.svg)](https://www.npmjs.com/package/bro-auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
---

## Overview

bro-auth is a stateless authentication library that strengthens JWT security by binding tokens to a browser/device fingerprint and deriving signing keys per user + device.

It is designed to:

* Prevent token-only theft
* Block non-browser and cross-device replay
* Keep authentication stateless and scalable
* Be plug-and-play for developers

> **bro-auth strengthens stateless JWT authentication by binding tokens to browser context.**  
> It is designed to make token theft, cross-device reuse, and blind replay attacks significantly harder — while remaining fully stateless and developer-friendly.
---

## Why bro-auth?

JWT-based authentication is simple and scalable — but **by default, JWTs are bearer tokens**.  
If a token is stolen, it can often be reused from anywhere.

**bro-auth raises the security bar without adding server-side state.**

It does this by:
- Binding tokens to the browser/device that created them
- Deriving signing keys per user + device context
- Making token-only theft insufficient for reuse
- Preventing cross-browser and non-browser replay
- Keeping the system fully stateless and horizontally scalable

bro-auth is ideal when you want:
- Better security than plain JWT
- Zero session storage
- Simple developer experience
- Clear, well-defined security trade-offs


---

## Threat Model (Important – Read This)

### bro-auth protects against:

* JWT copied from logs, storage, or memory
* Token reuse from a different browser/device
* Non-browser attacks (curl, Postman, bots)
* Token swapping across users
* Blind replay without browser context

### bro-auth does NOT protect against:

* XSS with active JS execution
* Malicious browser extensions
* Compromised dependencies running in-browser
* Replay after fingerprint observation
* Full device compromise

> **This is a hard limit of stateless authentication, not a bug.**

---

## High-Level Design

### Core idea

A JWT is only valid if the same browser fingerprint that created it is presented again.

### Authentication Flow

#### 1. Login

```
Browser                                  Server
  │
  ├─ Generate RAW fingerprint
  │  (Canvas, GPU, UA, timezone, etc.)
  │
  ├─ POST /login ─────────────────────▶ Verify credentials
  │  { username, password, rawFP }      │
  │                                     ├─ Normalize & hash fingerprint:
  │                                     │  fpHash = SHA256(rawFP)
  │                                     │
  │                                     ├─ Derive signing secret:
  │                                     │  HMAC(pepper, secret|userId|fpHash)
  │                                     │
  │                                     ├─ Sign JWT
  │                                     │  Payload: { sub, fp: fpHash }
  │
  ◀──────────────────────────────────── Return tokens
```

#### 2. Protected API Request

```
Browser                                  Server
  │
  ├─ GET /api/protected ──────────────▶
  │  Authorization: Bearer <token>     │
  │  X-Fingerprint: <rawFP>            │
  │                                    │
  │                                    ├─ Hash fingerprint again:
  │                                    │  SHA256(rawFP)
  │                                    │
  │                                    ├─ Re-derive signing secret
  │                                    │
  │                                    ├─ Verify JWT signature
  │                                    │
  │                                    ├─ Compare fp hashes
  │                                    │
  ◀──────────────────────────────────── Access granted
```

### Why Token-Only Theft Fails

If an attacker steals **only the JWT:**

* They do not know the browser fingerprint
* Signature verification fails
* Token cannot be reused elsewhere

If the attacker also steals the raw fingerprint:

* Replay may succeed until token expiry
* This is a known stateless limitation

---

## Installation

```bash
npm install bro-auth
```

---

## Environment Variables

```bash
BRO_AUTH_SECRET_PEPPER=long-random-server-only-value
ACCESS_SECRET=your-access-secret
REFRESH_SECRET=your-refresh-secret
```

> ⚠️ **These secrets must never be exposed to the browser.**

---

## Browser Usage

### Generate fingerprint (RAW)

```javascript
import { getFingerprint } from "bro-auth/browser";

async function handleLogin() {
  // Generate device fingerprint hash
  const rawFingerprint = await getFingerprint();
  
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "user@example.com",
      password: "password123",
      fingerprint: rawFingerprint
    })
  });
  
  const { accessToken, refreshToken } = await response.json();
  
  // Store access token (see Token Storage Best Practices below)
  sessionStorage.setItem("accessToken", accessToken);
  
  // Refresh token is typically set as HTTP-only cookie by the server
}
```

**Returns:** A normalized raw string  
**Note:** Never hashed on the client, sent as-is to the backend

---

## Server Usage

### Generate Tokens

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
    fingerprint,                      // RAW fingerprint from browser
    process.env.ACCESS_SECRET,        // your secret
    process.env.REFRESH_SECRET        // your secret
  );
  
  res.json({ accessToken, refreshToken });
});
```

> **Note:** bro-auth hashes the fingerprint internally using SHA-256.

### Verify Access Token

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
    fingerprint,                      // RAW fingerprint
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

### Why RAW FP → Server-Side Hashing?

* Prevents trusting client-side hashes blindly
* Ensures consistent normalization
* Improves debuggability
* Avoids mismatch bugs
* Keeps hashing logic centralized

> **Hashing is not claimed as replay prevention** — it is a binding and consistency mechanism.

---

## API Reference (Key Functions)

### `getFingerprint()`

Returns normalized raw fingerprint string.

### `generateTokens(userId, rawFP, accessSecret, refreshSecret)`

* Hashes fingerprint internally
* Derives signing secrets
* Issues access + refresh tokens

### `verifyAccessToken(token, rawFP, secret)`

* Hashes fingerprint again
* Re-derives signing key
* Verifies JWT integrity & binding

### Refresh Tokens

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

## Token Storage Best Practices

### Access Token Storage

You can store access tokens in:

* **HTTP-only cookies** (Recommended) - Most secure, immune to XSS
* **Session storage** - Good for SPAs, cleared on tab close
* **Local storage** - Not recommended, vulnerable to XSS attacks
* **Memory (React state/Vue reactive)** - Secure but lost on page refresh

**Best practice:** Use HTTP-only cookies for maximum security.

#### Example: Storing Access Token in HTTP-only Cookie (Server-side)

```javascript
import { generateTokens } from "bro-auth/core";

app.post("/api/login", async (req, res) => {
  const { username, password, fingerprint } = req.body;
  const user = await authenticateUser(username, password);
  
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  const { accessToken, refreshToken } = generateTokens(
    user.id,
    fingerprint,
    process.env.ACCESS_SECRET,
    process.env.REFRESH_SECRET
  );
  
  // Set access token as HTTP-only cookie
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
  
  // Set refresh token as HTTP-only cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
  res.json({ success: true });
});
```

### Refresh Token Storage

**Always store refresh tokens in HTTP-only cookies.** 

bro-auth provides a built-in helper method `buildRefreshCookie` to simplify this.

#### Using `buildRefreshCookie`

```javascript
import { generateTokens, buildRefreshCookie } from "bro-auth/core";

app.post("/api/login", async (req, res) => {
  const { username, password, fingerprint } = req.body;
  const user = await authenticateUser(username, password);
  
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  const { accessToken, refreshToken } = generateTokens(
    user.id,
    fingerprint,
    process.env.ACCESS_SECRET,
    process.env.REFRESH_SECRET
  );
  
  // Use bro-auth's built-in helper for refresh token cookie
  const refreshCookie = buildRefreshCookie(refreshToken);
  
  res.cookie(
    refreshCookie.name,
    refreshCookie.value,
    refreshCookie.options
  );
  
  // Return access token (client can store in sessionStorage or cookie)
  res.json({ accessToken });
});
```

#### Custom Configuration for `buildRefreshCookie`

```javascript
import { buildRefreshCookie } from "bro-auth/core";

// Default: 7 days
const cookie = buildRefreshCookie(refreshToken);

// Custom expiry: 24 hours
const cookie24h = buildRefreshCookie(refreshToken, 60 * 60 * 24);

// The cookie object contains:
// {
//   name: "bro_refresh",
//   value: "<token>",
//   options: {
//     httpOnly: true,
//     secure: true,
//     sameSite: "strict",
//     path: "/",
//     maxAge: <seconds>
//   }
// }
```

#### Clearing Refresh Token on Logout

```javascript
import { buildClearRefreshCookie } from "bro-auth/core";

app.post("/api/logout", (req, res) => {
  const clearCookie = buildClearRefreshCookie();
  
  res.cookie(
    clearCookie.name,
    clearCookie.value,
    clearCookie.options
  );
  
  res.json({ message: "Logged out successfully" });
});
```

### Additional Security Best Practices

* Use short-lived access tokens (5–15 min)
* Enable CSP (Content Security Policy) to reduce XSS risk
* Rotate secrets on compromise
* Always use HTTPS in production
* Implement rate limiting on authentication endpoints
* Treat bro-auth as hardening, not magic

---

## Full API Reference

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

#### `buildRefreshCookie(refreshToken, maxAge?)`

Generates a secure HTTP-only cookie configuration object for refresh tokens.

**Parameters:**
- `refreshToken` (string) - The refresh token
- `maxAge` (number, optional) - Cookie lifetime in seconds (default: 604800 = 7 days)

**Returns:** `Object`
```javascript
{
  name: "bro_refresh",
  value: string,
  options: {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: number
  }
}
```

**Example:**
```javascript
import { buildRefreshCookie } from "bro-auth/core";

const refreshCookie = buildRefreshCookie(refreshToken);

// Express/Fastify
res.cookie(
  refreshCookie.name,
  refreshCookie.value,
  refreshCookie.options
);

// Next.js App Router
import { cookies } from "next/headers";
cookies().set(
  refreshCookie.name,
  refreshCookie.value,
  refreshCookie.options
);
```

---

#### `buildClearRefreshCookie()`

Generates a cookie configuration object to clear the refresh token (for logout).

**Returns:** `Object` (same structure as `buildRefreshCookie` but with empty value and maxAge: 0)

**Example:**
```javascript
import { buildClearRefreshCookie } from "bro-auth/core";

app.post("/api/logout", (req, res) => {
  const clearCookie = buildClearRefreshCookie();
  
  res.cookie(
    clearCookie.name,
    clearCookie.value,
    clearCookie.options
  );
  
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

## FAQ (Corrected)

**"Is bro-auth replay-proof?"**

❌ No.  
It blocks token-only replay, not replay after full browser compromise.

**"Is this better than plain JWT?"**

✅ Yes. Significantly.

**"Is this WebAuthn?"**

❌ No.  
bro-auth is stateless. WebAuthn is stateful + hardware-backed.

---

## Final Positioning (Important)

**bro-auth is a stateless JWT hardening library.**  
It raises the bar against real-world JWT misuse while remaining scalable and developer-friendly.

That statement is:

* technically correct
* interview-safe
* production-honest

---

## Advanced Framework Examples

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

MIT © Vaishnav - Creator of bro-auth

---

## Links

- [NPM Package](https://www.npmjs.com/package/bro-auth)
- [GitHub Repository](https://github.com/ChakraVaishnav/bro-auth)
- [Report Issues](https://github.com/ChakraVaishnav/bro-auth/issues)
- [Portfolio](https://giyu.me)