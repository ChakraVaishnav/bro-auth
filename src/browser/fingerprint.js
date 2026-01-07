// Helper: hash using crypto-es
import { SHA256 } from "crypto-es";

// Generate Canvas fingerprint
async function getCanvasFingerprint() {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 20);
    ctx.fillStyle = "#000";
    ctx.fillText("bro-auth-fingerprint", 2, 15);

    return canvas.toDataURL();
  } catch {
    return "no-canvas";
  }
}

// GPU fingerprint
function getGPUFingerprint() {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");

    if (!gl) return "no-webgl";

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    return debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : "no-renderer";
  } catch {
    return "no-webgl";
  }
}

// MAIN FUNCTION: Normalized fingerprint
export async function getFingerprint() {
  const components = {
    userAgent: navigator.userAgent || "unknown",
    platform: navigator.platform || "unknown",
    language: navigator.language || "unknown",
    languages: (navigator.languages || []).join(",") || "unknown",
    colorDepth: String(screen.colorDepth || "unknown"),
    timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
    timezoneOffset: String(new Date().getTimezoneOffset()),
    cpuCores: String(navigator.hardwareConcurrency || "unknown"),
    deviceMemory: String(navigator.deviceMemory || "unknown"),
    gpu: getGPUFingerprint(),
    canvas: await getCanvasFingerprint(),
  };

  // ✅ Explicit order (VERY IMPORTANT)
  const normalizedString = [
    components.userAgent,
    components.platform,
    components.language,
    components.languages,
    components.colorDepth,
    components.timezone,
    components.timezoneOffset,
    components.cpuCores,
    components.deviceMemory,
    components.gpu,
    components.canvas,
  ].join("|");

  const hash = SHA256(normalizedString).toString();

  return {
    hash,
  };
}
