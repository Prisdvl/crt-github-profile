/**
 * Shared ChatGPT-like terminal palette.
 * Cool charcoal + teal accent (#10A37F). ASCII portrait stays blue/white.
 */
export const THEME = {
  bg: "#212121",
  surface: "#2a2a2a",
  titleBar: "#2a2a2a",
  border: "#3f3f3f",
  text: "#ececec",
  muted: "#8e8e8e",
  cloud: "#b4b4b4",
  accent: "#10A37F", // ChatGPT teal
  accentDeep: "#0D8C6D",
  kraft: "#E3B341",
  oat: "#d9d9e3",
  manilla: "#ececec",
  sky: "#8AB4F8",
  olive: "#10A37F",
  fig: "#AB68FF",
  ivory: "#ececec",
  buttonClose: "#FF5F57",
  buttonMin: "#FEBC2E",
  buttonMax: "#28C840",
};

/** Contribution heatmap intensity → blue/cyan (matches ASCII portrait) */
export const HEATMAP_LEVELS = [
  THEME.surface,
  "#1a2f3d",
  "#2d5f7a",
  "#4ea1ff",
  "#9ed0ff",
];

export const FONT_MONO =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";

export const WINDOW_RADIUS = 14;
const TITLE_BAR = 40;

/**
 * Make top/bottom corners match:
 * - mask (more reliable than clip-path on GitHub image proxy)
 * - strip rx from title-bar so top isn't "extra round"
 * - shorten square body/overlay fills so they don't paint over bottom radii
 * - draw a final rounded stroke so the frame reads as one window
 */
export function applyRoundedWindowClip(doc, { radius = WINDOW_RADIUS } = {}) {
  const svg = doc.documentElement;
  const w = Number(svg.getAttribute("width") || 1000);
  const h = Number(svg.getAttribute("height") || 0);
  if (!h) return;

  let defs = svg.getElementsByTagName("defs")[0];
  if (!defs) {
    defs = doc.createElement("defs");
    svg.insertBefore(defs, svg.firstChild);
  }

  // Mask: outside rounded rect is fully transparent (fixes square corners on GitHub).
  let mask = null;
  const masks = doc.getElementsByTagName("mask");
  for (let i = 0; i < masks.length; i++) {
    if (masks[i].getAttribute("id") === "windowMask") {
      mask = masks[i];
      break;
    }
  }
  if (!mask) {
    mask = doc.createElement("mask");
    mask.setAttribute("id", "windowMask");
    mask.setAttribute("maskUnits", "userSpaceOnUse");
    const mr = doc.createElement("rect");
    mr.setAttribute("id", "windowMaskRect");
    mask.appendChild(mr);
    defs.appendChild(mask);
  }
  const maskRect = mask.getElementsByTagName("rect")[0];
  maskRect.setAttribute("x", "0");
  maskRect.setAttribute("y", "0");
  maskRect.setAttribute("width", String(w));
  maskRect.setAttribute("height", String(h));
  maskRect.setAttribute("rx", String(radius));
  maskRect.setAttribute("ry", String(radius));
  maskRect.setAttribute("fill", "#ffffff");

  // Keep clipPath as a second line of defense
  let clip = null;
  const clips = doc.getElementsByTagName("clipPath");
  for (let i = 0; i < clips.length; i++) {
    if (clips[i].getAttribute("id") === "windowRound") {
      clip = clips[i];
      break;
    }
  }
  if (!clip) {
    clip = doc.createElement("clipPath");
    clip.setAttribute("id", "windowRound");
    clip.setAttribute("clipPathUnits", "userSpaceOnUse");
    const cr = doc.createElement("rect");
    cr.setAttribute("id", "windowRoundRect");
    clip.appendChild(cr);
    defs.appendChild(clip);
  }
  const clipRect = clip.getElementsByTagName("rect")[0];
  clipRect.setAttribute("x", "0");
  clipRect.setAttribute("y", "0");
  clipRect.setAttribute("width", String(w));
  clipRect.setAttribute("height", String(h));
  clipRect.setAttribute("rx", String(radius));
  clipRect.setAttribute("ry", String(radius));

  // Find window root group
  let root = null;
  for (let i = 0; i < svg.childNodes.length; i++) {
    const n = svg.childNodes[i];
    if (n.nodeName === "g") {
      root = n;
      break;
    }
  }
  if (!root) return;
  root.setAttribute("id", "windowRoot");
  root.setAttribute("mask", "url(#windowMask)");
  root.setAttribute("clip-path", "url(#windowRound)");

  const bodyMaxH = Math.max(0, h - TITLE_BAR - radius);

  const rects = [...doc.getElementsByTagName("rect")];
  for (const r of rects) {
    // skip mask/clip definition rects
    const parent = r.parentNode;
    if (
      parent &&
      (parent.nodeName === "clipPath" ||
        parent.nodeName === "mask" ||
        parent.nodeName === "pattern")
    ) {
      continue;
    }

    const x = r.getAttribute("x") || "0";
    const y = r.getAttribute("y") || "0";
    const width = r.getAttribute("width");
    const height = Number(r.getAttribute("height") || 0);
    const fill = r.getAttribute("fill") || "";

    // Full-window shell
    if (x === "0" && y === "0" && width === String(w) && height >= h - 1) {
      r.setAttribute("rx", String(radius));
      r.setAttribute("ry", String(radius));
      r.setAttribute("height", String(h));
      if (!fill.startsWith("url(")) r.setAttribute("fill", THEME.bg);
      continue;
    }

    // Title bar: no rx — outer mask provides top corners (matches bottom)
    if (x === "0" && y === "0" && width === String(w) && height > 0 && height <= TITLE_BAR + 2) {
      r.removeAttribute("rx");
      r.removeAttribute("ry");
      r.setAttribute("fill", THEME.surface);
      continue;
    }

    // Title bar filler strip under traffic lights
    if (
      x === "0" &&
      y === "16" &&
      width === String(w) &&
      height > 0 &&
      height <= 20
    ) {
      r.setAttribute("fill", THEME.surface);
      continue;
    }

    // Body / vignette / scanline fills starting at title bar — stop above bottom radius
    if (x === "0" && y === String(TITLE_BAR) && width === String(w) && height > 100) {
      r.setAttribute("height", String(bodyMaxH));
      r.removeAttribute("rx");
      r.removeAttribute("ry");
      if (!fill.startsWith("url(") && fill !== "none") {
        r.setAttribute("fill", THEME.bg);
      }
    }
  }

  // Update terminalViewport clip to shortened body
  for (let i = 0; i < clips.length; i++) {
    if (clips[i].getAttribute("id") === "terminalViewport") {
      const vr = clips[i].getElementsByTagName("rect")[0];
      if (vr) {
        vr.setAttribute("height", String(bodyMaxH));
      }
    }
  }

  // Remove prior frame stroke, then append a crisp rounded border (last paint)
  const oldStroke = doc.getElementById?.("windowFrameStroke");
  // xmldom may not have getElementById — scan
  let strokeEl = null;
  for (const r of [...doc.getElementsByTagName("rect")]) {
    if (r.getAttribute("id") === "windowFrameStroke") strokeEl = r;
  }
  if (strokeEl?.parentNode) strokeEl.parentNode.removeChild(strokeEl);

  const stroke = doc.createElement("rect");
  stroke.setAttribute("id", "windowFrameStroke");
  stroke.setAttribute("x", "0.5");
  stroke.setAttribute("y", "0.5");
  stroke.setAttribute("width", String(w - 1));
  stroke.setAttribute("height", String(h - 1));
  stroke.setAttribute("rx", String(radius));
  stroke.setAttribute("ry", String(radius));
  stroke.setAttribute("fill", "none");
  stroke.setAttribute("stroke", THEME.border);
  stroke.setAttribute("stroke-width", "1");
  stroke.setAttribute("pointer-events", "none");
  root.appendChild(stroke);
}

/**
 * macOS-style terminal chrome shared by projects / contrib cards.
 */
export function terminalFrame({
  width,
  height,
  title,
  ariaLabel,
  desc,
  body,
  titleBarH = 36,
}) {
  const { bg, surface, border, text, buttonClose, buttonMin, buttonMax } = THEME;
  const r = WINDOW_RADIUS;
  const bodyH = Math.max(0, height - titleBarH - r);
  return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}">
  <title>${title}</title>
  <desc>${desc}</desc>
  <defs>
    <mask id="windowMask" maskUnits="userSpaceOnUse">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${r}" ry="${r}" fill="#ffffff"/>
    </mask>
  </defs>
  <g id="windowRoot" mask="url(#windowMask)">
    <rect width="${width}" height="${height}" rx="${r}" ry="${r}" fill="${bg}"/>
    <rect x="0" y="0" width="${width}" height="${titleBarH}" fill="${surface}"/>
    <rect x="0" y="${titleBarH - 12}" width="${width}" height="12" fill="${surface}"/>
    <circle cx="18" cy="${titleBarH / 2}" r="5.5" fill="${buttonClose}"/>
    <circle cx="36" cy="${titleBarH / 2}" r="5.5" fill="${buttonMin}"/>
    <circle cx="54" cy="${titleBarH / 2}" r="5.5" fill="${buttonMax}"/>
    <text x="${width / 2}" y="${titleBarH / 2 + 4}" text-anchor="middle" font-family="${FONT_MONO}" font-size="12" fill="${text}">${title}</text>
    <rect x="0" y="${titleBarH}" width="${width}" height="${bodyH}" fill="${bg}"/>
    <g transform="translate(16, ${titleBarH + 14})">
${body}
    </g>
    <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${r}" ry="${r}" fill="none" stroke="${border}" stroke-width="1"/>
  </g>
</svg>
`;
}
