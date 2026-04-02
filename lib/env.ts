const isProduction = process.env.NODE_ENV === "production";

export function getSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();

  if (secret) {
    return secret;
  }

  if (isProduction) {
    throw new Error("SESSION_SECRET is required in production.");
  }

  return "levita-local-dev-secret";
}

export function getAiProvider() {
  return process.env.AI_PROVIDER?.trim().toLowerCase() || "";
}
