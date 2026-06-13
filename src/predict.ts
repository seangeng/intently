/**
 * The prediction math, lifted from the input-anticipation work
 * (https://seangeng.com/writing/interfaces-that-anticipate-input). Same engine
 * that warms a focus ring — here it scores how likely a link is your next click.
 */

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Velocity {
  x: number;
  y: number;
}

/** Distance from a point to the nearest edge of a rect (0 if inside). */
export function distanceToRect(x: number, y: number, r: Rect): number {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}

/** Turn a distance into 0–1 intent via a falloff curve. exponent=2 reads best. */
export function falloff(distance: number, radius: number, exponent = 2): number {
  return Math.max(0, 1 - distance / radius) ** exponent;
}

/**
 * Proximity confidence: how close is the cursor to this rect, 0–1.
 */
export function proximityScore(x: number, y: number, r: Rect, radius: number): number {
  return falloff(distanceToRect(x, y, r), radius);
}

/**
 * Trajectory confidence: is the cursor *heading at* this rect, 0–1. Uses the
 * dot product of the (normalized) velocity with the direction to the rect's
 * center, gated by a forward cone so a glancing pass scores ~0. Returns 0 when
 * the pointer is too slow to have a meaningful heading.
 */
export function trajectoryScore(
  x: number,
  y: number,
  v: Velocity,
  r: Rect,
  cone = 0.6,
): number {
  const speed = Math.hypot(v.x, v.y);
  if (speed < 0.04) return 0; // px/ms — basically still
  const cx = (r.left + r.right) / 2;
  const cy = (r.top + r.bottom) / 2;
  const dx = cx - x;
  const dy = cy - y;
  const d = Math.hypot(dx, dy) || 1;
  const align = (dx / d) * (v.x / speed) + (dy / d) * (v.y / speed); // -1..1
  if (align <= cone) return 0;
  // Remap (cone..1] → (0..1], and let faster, more committed moves score higher.
  const aligned = (align - cone) / (1 - cone);
  const committed = Math.min(1, speed / 0.6);
  return aligned * (0.6 + 0.4 * committed);
}

/** Exponential moving average of pointer velocity, in px/ms. */
export function updateVelocity(
  v: Velocity,
  prev: { x: number; y: number; t: number } | null,
  x: number,
  y: number,
  t: number,
  smoothing = 0.7,
): void {
  if (prev) {
    const dt = Math.max(1, t - prev.t);
    v.x = v.x * smoothing + ((x - prev.x) / dt) * (1 - smoothing);
    v.y = v.y * smoothing + ((y - prev.y) / dt) * (1 - smoothing);
  }
}
