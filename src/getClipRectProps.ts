export function getClipRectProps(
  start: number,
  end: number,
  height: number,
  y: number = 0
) {
  return {
    x: Math.min(start, end),
    y,
    width: Math.abs(start - end),
    height
  }
}
