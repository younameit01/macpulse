import React from 'react';
import { formatBps } from '../api';

export default function IoChart({ data = [], height = 180, title = 'Read / Write Throughput' }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
        No historical samples in this window
      </div>
    );
  }

  const width = 600;
  const padding = 35;

  const maxRate = Math.max(
    ...data.map((d) => Math.max(d.write_bps || 0, d.read_bps || 0)),
    1024 * 1024 // at least 1MB/s ceiling for scale
  );

  const getX = (idx) => {
    if (data.length <= 1) return padding;
    return padding + (idx / (data.length - 1)) * (width - 2 * padding);
  };

  const getY = (val) => {
    const clamped = Math.max(0, val || 0);
    const ratio = clamped / maxRate;
    return height - padding - ratio * (height - 2 * padding);
  };

  // Generate SVG path for write_bps (Crimson / Violet)
  const writePoints = data.map((d, i) => `${getX(i)},${getY(d.write_bps)}`).join(' ');
  const writePath = data.length > 0 ? `M ${writePoints}` : '';

  // Generate SVG path for read_bps (Electric Cyan / Blue)
  const readPoints = data.map((d, i) => `${getX(i)},${getY(d.read_bps)}`).join(' ');
  const readPath = data.length > 0 ? `M ${readPoints}` : '';

  // Area under write path
  const writeArea = data.length > 1 
    ? `M ${getX(0)},${height - padding} L ${writePoints} L ${getX(data.length - 1)},${height - padding} Z`
    : '';

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
        <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f87171' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
            Write ({formatBps(data[data.length - 1]?.write_bps || 0)})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#60a5fa' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3b82f6' }}></span>
            Read ({formatBps(data[data.length - 1]?.read_bps || 0)})
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" style={{ width: '100%', height }}>
        <defs>
          <linearGradient id="writeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line x1={padding} y1={getY(maxRate)} x2={width - padding} y2={getY(maxRate)} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
        <text x={padding - 4} y={getY(maxRate) + 4} fill="var(--text-dim)" fontSize="10" textAnchor="end">
          {formatBps(maxRate)}
        </text>

        <line x1={padding} y1={getY(maxRate / 2)} x2={width - padding} y2={getY(maxRate / 2)} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
        <text x={padding - 4} y={getY(maxRate / 2) + 4} fill="var(--text-dim)" fontSize="10" textAnchor="end">
          {formatBps(maxRate / 2)}
        </text>

        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.12)" />
        <text x={padding - 4} y={height - padding + 4} fill="var(--text-dim)" fontSize="10" textAnchor="end">
          0 B/s
        </text>

        {/* Write fill & lines */}
        {writeArea && <path d={writeArea} fill="url(#writeGradient)" />}
        {writePath && <path d={writePath} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

        {/* Read line */}
        {readPath && <path d={readPath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 2" strokeLinecap="round" strokeLinejoin="round" />}

        {/* Dots for latest point */}
        {data.length > 0 && (
          <>
            <circle cx={getX(data.length - 1)} cy={getY(data[data.length - 1].write_bps)} r="4" fill="#ef4444" />
            <circle cx={getX(data.length - 1)} cy={getY(data[data.length - 1].read_bps)} r="3" fill="#3b82f6" />
          </>
        )}
      </svg>
    </div>
  );
}
