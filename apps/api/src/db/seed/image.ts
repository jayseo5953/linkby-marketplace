const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]!);
}

function hueFor(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.codePointAt(0)!) % 360;
  }
  return hash;
}

/**
 * Placeholder product imagery, so seeded listings have something to show without
 * shipping binary fixtures. Saturation and lightness are fixed dark enough that the
 * white label stays readable at every hue.
 *
 * The index feeds both the hue and a counter caption: a product with five images
 * needs five distinguishable ones, or the gallery cannot be told from a bug. The hue
 * steps by a coprime-ish stride rather than by hashing the index in, which would move
 * the colour by a degree or two and look identical.
 */
export function svgFor(name: string, index: number, total: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="hsl(${(hueFor(name) + index * 47) % 360}, 55%, 38%)"/>
  <text x="400" y="290" fill="#ffffff" font-family="Helvetica, Arial, sans-serif" font-size="44" text-anchor="middle" dominant-baseline="middle">${escapeXml(name)}</text>
  <text x="400" y="360" fill="#ffffff" font-family="Helvetica, Arial, sans-serif" font-size="28" text-anchor="middle" dominant-baseline="middle" opacity="0.75">${index + 1} of ${total}</text>
</svg>
`;
}
