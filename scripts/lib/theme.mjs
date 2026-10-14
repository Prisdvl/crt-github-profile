/**
 * Shared Claude / Anthropic–inspired terminal palette.
 * Warm slate + Clay accent — not Matrix green-on-black.
 */
export const THEME = {
  bg: "#141413",
  surface: "#1C1B19",
  titleBar: "#1C1B19",
  border: "#3D3D3A",
  text: "#FAF9F5",
  muted: "#87867F",
  cloud: "#B0AEA5",
  accent: "#D97757", // Clay
  accentDeep: "#C6613F",
  kraft: "#D4A27F",
  oat: "#E3DACC",
  manilla: "#EBDBBC",
  sky: "#6A9BCC",
  olive: "#788C5D",
  fig: "#C46686",
  ivory: "#FAF9F5",
  buttonClose: "#C6613F",
  buttonMin: "#D4A27F",
  buttonMax: "#788C5D",
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
