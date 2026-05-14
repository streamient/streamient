(() => {
  // src/email_dark_mode_rules.js
  var NAMED_COLORS = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    transparent: [0, 0, 0, 0]
  };
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function normalizeAlpha(value) {
    if (value === void 0 || value === "") return 1;
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return clamp(parsed, 0, 1);
  }
  function parseHexColor(value) {
    var hex = value.replace("#", "").trim();
    if (![3, 4, 6, 8].includes(hex.length)) return null;
    if (!/^[0-9a-f]+$/i.test(hex)) return null;
    if (hex.length === 3 || hex.length === 4) {
      var parts = hex.split("").map(function(part) {
        return parseInt(part + part, 16);
      });
      return {
        r: parts[0],
        g: parts[1],
        b: parts[2],
        a: parts[3] === void 0 ? 1 : parts[3] / 255
      };
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
    };
  }
  function parseRgbPart(value) {
    var raw = String(value || "").trim();
    if (raw.endsWith("%")) return clamp(Math.round(Number(raw.slice(0, -1)) * 2.55), 0, 255);
    return clamp(Math.round(Number(raw)), 0, 255);
  }
  function parseRgbColor(value) {
    var match = String(value || "").match(/^rgba?\((.+)\)$/i);
    if (!match) return null;
    var body = match[1].trim();
    var alpha;
    var colorParts;
    if (body.includes(",")) {
      var parts = body.split(",").map(function(part) {
        return part.trim();
      });
      colorParts = parts.slice(0, 3);
      alpha = parts[3];
    } else {
      var split = body.split("/").map(function(part) {
        return part.trim();
      });
      colorParts = split[0].split(/\s+/g);
      alpha = split[1];
    }
    if (colorParts.length < 3) return null;
    return {
      r: parseRgbPart(colorParts[0]),
      g: parseRgbPart(colorParts[1]),
      b: parseRgbPart(colorParts[2]),
      a: normalizeAlpha(alpha)
    };
  }
  function parseCssColor(value) {
    var raw = String(value || "").trim().toLowerCase();
    if (!raw || raw === "inherit" || raw === "initial" || raw === "currentcolor") return null;
    if (NAMED_COLORS[raw]) {
      var named = NAMED_COLORS[raw];
      return { r: named[0], g: named[1], b: named[2], a: named[3] === void 0 ? 1 : named[3] };
    }
    if (raw.startsWith("#")) return parseHexColor(raw);
    if (raw.startsWith("rgb")) return parseRgbColor(raw);
    return null;
  }
  function colorLuminance(color) {
    if (!color || color.a === 0) return 1;
    function channel(value) {
      var normalized = value / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  }
  function colorSaturation(color) {
    if (!color) return 0;
    var max = Math.max(color.r, color.g, color.b) / 255;
    var min = Math.min(color.r, color.g, color.b) / 255;
    if (max === min) return 0;
    var lightness = (max + min) / 2;
    return lightness > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  }
  function shouldDarkenBackground(value) {
    var color = parseCssColor(value);
    if (!color || color.a < 0.12) return false;
    return colorLuminance(color) > 0.52 && colorSaturation(color) < 0.72;
  }
  function shouldLightenText(value) {
    var color = parseCssColor(value);
    if (!color || color.a < 0.12) return false;
    return colorLuminance(color) < 0.36 && colorSaturation(color) < 0.52;
  }
  function shouldMuteBorder(value) {
    var color = parseCssColor(value);
    if (!color || color.a < 0.12) return false;
    var luminance = colorLuminance(color);
    var saturation = colorSaturation(color);
    return saturation < 0.4 && (luminance > 0.58 || luminance < 0.24);
  }

  // src/email_dark_mode_child.js
  var SURFACE = "#1a1f25";
  var SURFACE_ALT = "#20262d";
  var TEXT = "#e8edf3";
  var MUTED = "#b7c0cc";
  var BORDER = "#3a424d";
  function cssValue(value) {
    return String(value || "").trim();
  }
  function readableStyle(element) {
    try {
      return window.getComputedStyle(element);
    } catch {
      return null;
    }
  }
  function styleHasValue(style, property) {
    return Boolean(cssValue(style.getPropertyValue(property)));
  }
  function adjustElement(element) {
    if (!(element instanceof HTMLElement)) return;
    if (["IMG", "PICTURE", "SVG", "CANVAS", "VIDEO"].includes(element.tagName)) return;
    var style = element.style;
    var background = cssValue(style.backgroundColor || style.background);
    var color = cssValue(style.color || element.getAttribute("color"));
    var bgcolor = cssValue(element.getAttribute("bgcolor"));
    var computed = readableStyle(element);
    var computedBackground = cssValue(computed?.backgroundColor);
    var computedColor = cssValue(computed?.color);
    if (bgcolor && shouldDarkenBackground(bgcolor)) {
      element.setAttribute("bgcolor", SURFACE);
      style.setProperty("background-color", SURFACE, "important");
    }
    if (background && shouldDarkenBackground(background)) {
      style.setProperty("background-color", element.closest("table") ? SURFACE_ALT : SURFACE, "important");
      style.removeProperty("background-image");
    }
    if (!background && computedBackground && shouldDarkenBackground(computedBackground)) {
      style.setProperty("background-color", element.closest("table") ? SURFACE_ALT : SURFACE, "important");
      style.removeProperty("background-image");
    }
    if (color && shouldLightenText(color)) {
      style.setProperty("color", TEXT, "important");
      if (element.hasAttribute("color")) element.setAttribute("color", TEXT);
    }
    if (!color && computedColor && shouldLightenText(computedColor)) {
      style.setProperty("color", TEXT, "important");
    }
    [
      "border-color",
      "border-top-color",
      "border-right-color",
      "border-bottom-color",
      "border-left-color"
    ].forEach(function(property) {
      if (styleHasValue(style, property) && shouldMuteBorder(style.getPropertyValue(property))) {
        style.setProperty(property, BORDER, "important");
      }
    });
  }
  function styleQuotes() {
    document.querySelectorAll("blockquote,.gmail_quote,.yahoo_quoted,.moz-cite-prefix").forEach(function(element) {
      if (!(element instanceof HTMLElement)) return;
      element.style.setProperty("border-left", "4px solid #4aa3df", "important");
      element.style.setProperty("padding-left", "16px", "important");
      element.style.setProperty("margin-left", "0", "important");
      element.style.setProperty("background-color", "rgba(255,255,255,0.035)", "important");
      element.style.setProperty("color", MUTED, "important");
    });
  }
  function applyDarkMode() {
    if (document.documentElement.dataset.kkEmailTheme !== "dark") return;
    document.documentElement.style.setProperty("background-color", "#0f141b", "important");
    document.body?.style.setProperty("background-color", "#0f141b", "important");
    document.body?.style.setProperty("color", TEXT, "important");
    document.querySelectorAll("*").forEach(adjustElement);
    styleQuotes();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyDarkMode, { once: true });
  } else {
    applyDarkMode();
  }
  window.addEventListener("load", applyDarkMode, { once: true });
})();
