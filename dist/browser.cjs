var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/browser/index.js
var browser_exports = {};
__export(browser_exports, {
  getFingerprint: () => getFingerprint
});
module.exports = __toCommonJS(browser_exports);

// src/browser/fingerprint.js
var import_crypto_es = require("crypto-es");
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
function getGPUFingerprint() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "no-webgl";
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "no-renderer";
  } catch {
    return "no-webgl";
  }
}
async function getFingerprint() {
  const components = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: navigator.languages.join(","),
    screen: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: (/* @__PURE__ */ new Date()).getTimezoneOffset(),
    cpuCores: navigator.hardwareConcurrency || "unknown",
    deviceMemory: navigator.deviceMemory || "unknown",
    gpu: getGPUFingerprint(),
    canvas: await getCanvasFingerprint()
  };
  const rawString = Object.values(components).join("|");
  const fpHash = (0, import_crypto_es.SHA256)(rawString).toString();
  return {
    raw: rawString,
    hash: fpHash,
    components
  };
}
