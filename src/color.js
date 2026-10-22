// Contraste WCAG 2 entre dos colores `#rrggbb`, y el ajuste de luminosidad que lo alcanza.

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const toHsl = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};

const toHex = ([h, s, l]) => {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// El mismo matiz y saturación con la luminosidad movida, de 1 en 1 %, lejos del
// fondo hasta llegar a `min`:1. Un color que ya pasa sale tal cual.
export function legible(hex, bg, min = 3) {
  if (contrast(hex, bg) >= min) return hex;
  const [h, s, l0] = toHsl(hex);
  const step = luminance(bg) > 0.18 ? -0.01 : 0.01;
  for (let l = l0; l >= 0 && l <= 1; l += step) {
    const c = toHex([h, s, l]);
    if (contrast(c, bg) >= min) return c;
  }
  return step < 0 ? '#161616' : '#e8e8e8';
}
