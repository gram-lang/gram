// Shared between astro.config.mjs (Starlight `head` entries) and Layout.astro
// (custom pages: homepage, blog, playground) so the two injection paths never drift apart.

export const UMAMI_WEBSITE_ID = "fa1b1921-1982-4198-bb2b-c30d24f587ce";
export const UMAMI_SCRIPT_SRC = "/script.js";

export const FR_REDIRECT_SCRIPT = `if (typeof window !== "undefined" && (window.location.pathname === "/" || window.location.pathname === "/index.html")) {
  var lang = navigator.language || navigator.userLanguage || "";
  if (lang.toLowerCase().startsWith("fr") && !sessionStorage.getItem("lang_redirected")) {
    sessionStorage.setItem("lang_redirected", "true");
    window.location.replace("/fr/");
  }
}`;
