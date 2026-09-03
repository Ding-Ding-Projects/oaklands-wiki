import { useId, useMemo, useState } from 'react';

/**
 * A continuous colour picker with a format translator.
 *
 * Deliberately not a swatch list. A finite palette is a different control that
 * happens to look similar: it cannot express a colour the designer did not
 * anticipate, which is the whole point of letting somebody choose one.
 *
 * The translator converts between the formats a person actually needs to paste
 * somewhere, and reports the contrast against the surfaces this accent lands on
 * — because "pick any colour" and "pick a colour nobody can read" are one
 * keystroke apart.
 */

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0));
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: Math.round(h * 60), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100, ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** WCAG relative luminance, for a contrast ratio that means something. */
function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number | null {
  const ca = hexToRgb(a), cb = hexToRgb(b);
  if (!ca || !cb) return null;
  const la = luminance(ca), lb = luminance(cb);
  const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  return Math.round(ratio * 100) / 100;
}

export function ColourPicker({
  value,
  onChange,
  againstDark = '#0d0f13',
  againstLight = '#f7f8fa',
}: {
  value: string;
  onChange: (hex: string) => void;
  againstDark?: string;
  againstLight?: string;
}) {
  const id = useId();
  const [text, setText] = useState(value);

  const rgb = useMemo(() => hexToRgb(value) ?? { r: 0, g: 0, b: 0 }, [value]);
  const hsl = useMemo(() => rgbToHsl(rgb.r, rgb.g, rgb.b), [rgb]);
  const onDark = contrastRatio(value, againstDark);
  const onLight = contrastRatio(value, againstLight);

  const commitText = (raw: string) => {
    setText(raw);
    const hex = hexToRgb(raw);
    if (hex) onChange(rgbToHex(hex.r, hex.g, hex.b));
  };

  const setHsl = (part: Partial<{ h: number; s: number; l: number }>) => {
    const next = { ...hsl, ...part };
    const hex = hslToHex(next.h, next.s, next.l);
    onChange(hex);
    setText(hex);
  };

  return (
    <div className="ok-colour">
      <div className="ok-colour__row">
        <span className="ok-colour__swatch" style={{ background: value }} aria-hidden="true" />
        <input
          type="color"
          aria-label="Colour"
          value={value}
          onChange={(event) => { onChange(event.target.value); setText(event.target.value); }}
        />
        <input
          type="text"
          aria-label="Colour value"
          spellCheck={false}
          value={text}
          onChange={(event) => commitText(event.target.value)}
          style={{ fontFamily: 'var(--ok-font-mono)', maxWidth: '9rem' }}
        />
      </div>

      {/* Continuous, not a palette: every hue, saturation and lightness reachable. */}
      <div className="ok-colour__sliders">
        <label htmlFor={`${id}-h`}>Hue <output>{hsl.h}&deg;</output></label>
        <input id={`${id}-h`} type="range" min={0} max={359} value={hsl.h} onChange={(e) => setHsl({ h: Number(e.target.value) })} />
        <label htmlFor={`${id}-s`}>Saturation <output>{hsl.s}%</output></label>
        <input id={`${id}-s`} type="range" min={0} max={100} value={hsl.s} onChange={(e) => setHsl({ s: Number(e.target.value) })} />
        <label htmlFor={`${id}-l`}>Lightness <output>{hsl.l}%</output></label>
        <input id={`${id}-l`} type="range" min={0} max={100} value={hsl.l} onChange={(e) => setHsl({ l: Number(e.target.value) })} />
      </div>

      <details className="ok-colour__translate">
        <summary>Other formats</summary>
        <dl>
          <dt>HEX</dt><dd><code>{value}</code></dd>
          <dt>RGB</dt><dd><code>rgb({rgb.r}, {rgb.g}, {rgb.b})</code></dd>
          <dt>HSL</dt><dd><code>hsl({hsl.h}, {hsl.s}%, {hsl.l}%)</code></dd>
        </dl>
      </details>

      <p className="ok-colour__contrast">
        Contrast {onDark ?? '—'}:1 on the dark surface, {onLight ?? '—'}:1 on the light one.{' '}
        {(onDark ?? 0) < 3 || (onLight ?? 0) < 3
          ? <strong>Below 3:1 somewhere — hard to read as a link or a label.</strong>
          : 'Both readable.'}
      </p>
    </div>
  );
}
