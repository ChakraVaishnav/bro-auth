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
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "no-webgl";

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    return debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : "no-renderer";
  } catch {
    return "no-webgl";
  }
}

// MAIN FUNCTION: Advanced fingerprint
export async function getFingerprint() {
  const components = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: navigator.languages.join(","),
    screen: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    cpuCores: navigator.hardwareConcurrency || "unknown",
    deviceMemory: navigator.deviceMemory || "unknown",
    gpu: getGPUFingerprint(),
    canvas: await getCanvasFingerprint(),
  };

  const rawString = Object.values(components).join("|");
  const fpHash = SHA256(rawString).toString();

  return {
    raw: rawString,
    hash: fpHash,
    components
  };
}
