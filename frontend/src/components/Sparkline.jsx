import { useId } from "react";
import { TEAL } from "../lib/palette.js";

// Lightweight hand-rolled SVG sparkline — reliable at any size (no recharts
// container measuring). Draws a soft gradient area + line + end dot.
export default function Sparkline({ values, color = TEAL, width = 132, height = 36 }) {
  const id = useId();
  const vals = values?.filter((v) => v != null) ?? [];
  if (vals.length < 2) return null;

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pad = 3;
  const stepX = width / (values.length - 1);
  const y = (v) => height - pad - ((v - min) / span) * (height - pad * 2);

  const pts = values.map((v, i) => (v == null ? null : [i * stepX, y(v)])).filter(Boolean);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${height} L ${pts[0][0].toFixed(1)} ${height} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg
      className="spark"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`spk-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spk-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill={color} />
    </svg>
  );
}
