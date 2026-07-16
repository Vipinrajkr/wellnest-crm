// ui/reports/barChart.js
// Minimal, dependency-free bar chart renderer — draws directly to a
// <canvas> with no charting library, consistent with the app's
// offline-only, no-bundler constraints. Scoped to ui/reports/ since it's
// the only consumer so far; promote to services/ if another screen needs
// charts later.

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ label: string, total: number }[]} series
 */
export function renderBarChart(canvas, series) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 320;
  const height = canvas.clientHeight || 180;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (!series || !series.length) return;

  const rootStyles = getComputedStyle(document.documentElement);
  const barColor = rootStyles.getPropertyValue('--color-primary').trim() || '#2f9e6e';
  const labelColor = rootStyles.getPropertyValue('--color-text-muted').trim() || '#6b7280';

  const paddingLeft = 8;
  const paddingBottom = 20;
  const paddingTop = 12;
  const chartWidth = width - paddingLeft * 2;
  const chartHeight = height - paddingBottom - paddingTop;

  const maxValue = Math.max(1, ...series.map((point) => point.total));
  const barGap = 8;
  const barWidth = Math.max(4, chartWidth / series.length - barGap);

  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';

  series.forEach((point, index) => {
    const barHeight = maxValue > 0 ? (point.total / maxValue) * chartHeight : 0;
    const x = paddingLeft + index * (barWidth + barGap);
    const y = paddingTop + (chartHeight - barHeight);

    ctx.fillStyle = barColor;
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = labelColor;
    ctx.fillText(point.label, x + barWidth / 2, height - 6);
  });
}
