// ===== Vuetify 2-compatible lighten/darken =====
// Vuetify 3 has no `darken-1`/`lighten-1` variants of theme colors (only `bg-secondary` is available).
// Upstream Holodex (Vue 2) uses `secondary darken-1` and the like heavily, e.g. in headers. To reproduce
// that, derived colors are generated with the same algorithm as Vuetify 2 (sRGB→XYZ→Lab, shifting L by
// ±amount*10) and registered in the theme in vuetify.ts as colors such as `secondary-darken-1`.
// Note: darken(sec,1)=#8598ad / darken(sec,3)=#526578 (Steel secondary #9fb3c8) were verified to match the values upstream actually renders.
function srgbToLinear(c: number): number { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function linearToSrgb(c: number): number {
    const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
}
const D65 = [95.047, 100, 108.883];
function hexToRgb(h: string): number[] {
    const s = h.replace("#", "");
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function rgbToHex([r, g, b]: number[]): string { return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`; }
function rgbToXyz([r, g, b]: number[]): number[] {
    const rl = srgbToLinear(r); const gl = srgbToLinear(g); const bl = srgbToLinear(b);
    return [(0.4124 * rl + 0.3576 * gl + 0.1805 * bl) * 100, (0.2126 * rl + 0.7152 * gl + 0.0722 * bl) * 100, (0.0193 * rl + 0.1192 * gl + 0.9505 * bl) * 100];
}
function xyzToRgb([x, y, z]: number[]): number[] {
    const xn = x / 100; const yn = y / 100; const zn = z / 100;
    return [
        linearToSrgb(3.2406 * xn - 1.5372 * yn - 0.4986 * zn),
        linearToSrgb(-0.9689 * xn + 1.8758 * yn + 0.0415 * zn),
        linearToSrgb(0.0557 * xn - 0.204 * yn + 1.057 * zn),
    ];
}
function xyzToLab([x, y, z]: number[]): number[] {
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(x / D65[0]); const fy = f(y / D65[1]); const fz = f(z / D65[2]);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function labToXyz([l, a, b]: number[]): number[] {
    const y = (l + 16) / 116; const x = a / 500 + y; const z = y - b / 200;
    const f = (t: number) => { const t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; };
    return [f(x) * D65[0], f(y) * D65[1], f(z) * D65[2]];
}
/** Vuetify 2-compatible lightness adjustment. amount>0 lightens, <0 darkens (darken uses a negative amount). */
export function lighten(hex: string, amount: number): string {
    const lab = xyzToLab(rgbToXyz(hexToRgb(hex)));
    lab[0] = Math.max(0, Math.min(100, lab[0] + amount * 10));
    return rgbToHex(xyzToRgb(labToXyz(lab)));
}
export function darken(hex: string, amount: number): string { return lighten(hex, -amount); }

// Color theme definitions.
// Generic color names, each with dark and light variants. The palettes are based on proven values from Tailwind CSS /
// Radix Colors; for legibility, dark uses lighter shades (300–400) and light uses deeper shades (500–700) as primary.
// Order: muted (low-saturation) themes first, vivid ones after. The first entry (id 0) is the default theme.
// Array order = id (plugins/vuetify.ts and Settings.vue look themes up by index, so keep id and position in sync).
export default [
  // ===== Muted themes (low saturation, calm) =====
  {
    name: "Steel",
    id: 0, // default theme
    themes: {
      dark: {
        background: "#0d1014",
        primary: "#7d9bc1", // muted steel-blue
        secondary: "#9fb3c8",
      },
      light: {
        background: "#f2f4f7",
        primary: "#41699b",
        secondary: "#5b7da8",
      },
    },
  },
  {
    name: "Slate",
    id: 1,
    themes: {
      dark: {
        background: "#0d0f12",
        primary: "#94a3b8", // slate-400
        secondary: "#cbd5e1", // slate-300
      },
      light: {
        background: "#f4f5f7",
        primary: "#475569", // slate-600
        secondary: "#64748b", // slate-500
      },
    },
  },
  {
    name: "Stone",
    id: 2,
    themes: {
      dark: {
        background: "#12110f",
        primary: "#a8a29e", // stone-400
        secondary: "#d6d3d1", // stone-300
      },
      light: {
        background: "#f6f5f3",
        primary: "#57534e", // stone-600
        secondary: "#78716c", // stone-500
      },
    },
  },
  {
    name: "Sage",
    id: 3,
    themes: {
      dark: {
        background: "#0e110e",
        primary: "#94b08f", // muted sage-green
        secondary: "#b3c7ab",
      },
      light: {
        background: "#f2f5f0",
        primary: "#5a7a55",
        secondary: "#6f8f68",
      },
    },
  },
  {
    name: "Dusk",
    id: 4,
    themes: {
      dark: {
        background: "#100f14",
        primary: "#9b96c4", // muted dusk violet-grey
        secondary: "#b6b0d6",
      },
      light: {
        background: "#f3f2f7",
        primary: "#5d5788",
        secondary: "#726ca0",
      },
    },
  },
  // ===== Vivid themes =====
  {
    name: "Blue",
    id: 5,
    themes: {
      dark: {
        background: "#0f1115",
        primary: "#60a5fa", // blue-400
        secondary: "#38bdf8", // sky-400
      },
      light: {
        background: "#f4f6fa",
        primary: "#2563eb", // blue-600
        secondary: "#0284c7", // sky-600
      },
    },
  },
  {
    name: "Teal",
    id: 6,
    themes: {
      dark: {
        background: "#0c1413",
        primary: "#2dd4bf", // teal-400
        secondary: "#34d399", // emerald-400
      },
      light: {
        background: "#f1f7f5",
        primary: "#0d9488", // teal-600
        secondary: "#059669", // emerald-600
      },
    },
  },
  {
    name: "Violet",
    id: 7,
    themes: {
      dark: {
        background: "#120f17",
        primary: "#a78bfa", // violet-400
        secondary: "#c084fc", // purple-400
      },
      light: {
        background: "#f6f3fb",
        primary: "#7c3aed", // violet-600
        secondary: "#9333ea", // purple-600
      },
    },
  },
  {
    name: "Indigo",
    id: 8,
    themes: {
      dark: {
        background: "#0e0f17",
        primary: "#818cf8", // indigo-400
        secondary: "#60a5fa", // blue-400
      },
      light: {
        background: "#f3f4fb",
        primary: "#4f46e5", // indigo-600
        secondary: "#2563eb", // blue-600
      },
    },
  },
  {
    name: "Rose",
    id: 9,
    themes: {
      dark: {
        background: "#151012",
        primary: "#fb7185", // rose-400
        secondary: "#f472b6", // pink-400
      },
      light: {
        background: "#fbf3f5",
        primary: "#e11d48", // rose-600
        secondary: "#db2777", // pink-600
      },
    },
  },
  {
    name: "Amber",
    id: 10,
    themes: {
      dark: {
        background: "#14110a",
        primary: "#fbbf24", // amber-400
        secondary: "#fb923c", // orange-400
      },
      light: {
        background: "#faf6ec",
        primary: "#d97706", // amber-600
        secondary: "#ea580c", // orange-600
      },
    },
  },
  {
    name: "Lime",
    id: 11,
    themes: {
      dark: {
        background: "#0f130a",
        primary: "#a3e635", // lime-400
        secondary: "#4ade80", // green-400
      },
      light: {
        background: "#f4f7ec",
        primary: "#65a30d", // lime-600
        secondary: "#16a34a", // green-600
      },
    },
  },
];
