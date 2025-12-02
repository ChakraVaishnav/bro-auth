// For frameworks like Next.js, Express, Fastify, etc.
// The caller will handle how cookies are actually set.

export function buildRefreshCookie(token, maxAge = 60 * 60 * 24 * 7) {
  return {
    name: "bro_refresh",
    value: token,
    options: {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge,
    },
  };
}

export function buildClearRefreshCookie() {
  return {
    name: "bro_refresh",
    value: "",
    options: {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    },
  };
}
