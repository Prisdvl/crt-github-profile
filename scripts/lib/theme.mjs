/**
 * Shared ChatGPT-like terminal palette.
 * Cool charcoal + teal accent (#10A37F). ASCII portrait stays blue/white.
 */
export const THEME = {
  bg: "#212121",
  surface: "#2f2f2f",
  titleBar: "#171717",
  border: "#444444",
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

/**
 * macOS-style terminal chrome shared by projects / contrib cards.
 * Body content is injected as SVG markup (already escaped where needed).
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
  const bodyH = height - titleBarH;
  return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}">
  <title>${title}</title>
  <desc>${desc}</desc>
  <rect width="${width}" height="${height}" rx="12" ry="12" fill="${bg}"/>
  <rect x="0" y="0" width="${width}" height="${titleBarH}" rx="12" ry="12" fill="${surface}"/>
  <rect x="0" y="${titleBarH - 12}" width="${width}" height="12" fill="${surface}"/>
  <circle cx="18" cy="${titleBarH / 2}" r="5.5" fill="${buttonClose}"/>
  <circle cx="36" cy="${titleBarH / 2}" r="5.5" fill="${buttonMin}"/>
  <circle cx="54" cy="${titleBarH / 2}" r="5.5" fill="${buttonMax}"/>
  <text x="${width / 2}" y="${titleBarH / 2 + 4}" text-anchor="middle" font-family="${FONT_MONO}" font-size="12" fill="${text}">${title}</text>
  <rect x="0" y="${titleBarH}" width="${width}" height="${bodyH}" fill="${bg}"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" ry="12" fill="none" stroke="${border}" stroke-width="1"/>
  <g transform="translate(16, ${titleBarH + 14})">
${body}
  </g>
</svg>
`;
}
