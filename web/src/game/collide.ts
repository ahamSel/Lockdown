export interface Contact {
  nx: number;
  ny: number;
  depth: number;
}

/** Circle (cx, cy, r) vs axis-aligned square (sx, sy, half-size). Normal points from the square to the circle. */
export function circleSquare(cx: number, cy: number, r: number, sx: number, sy: number, half: number): Contact | null {
  const qx = Math.max(sx - half, Math.min(cx, sx + half));
  const qy = Math.max(sy - half, Math.min(cy, sy + half));
  const dx = cx - qx;
  const dy = cy - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }
  // Centre is inside the square: push out along the axis of least penetration.
  const ox = half - Math.abs(cx - sx);
  const oy = half - Math.abs(cy - sy);
  if (ox < oy) return { nx: Math.sign(cx - sx) || 1, ny: 0, depth: ox + r };
  return { nx: 0, ny: Math.sign(cy - sy) || 1, depth: oy + r };
}
