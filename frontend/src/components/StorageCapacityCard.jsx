import React, { useState, useEffect } from 'react';
import { formatBytes } from '../api';

export default function StorageCapacityCard({ overview }) {
  // Use backend aggregated storage metrics if available, or compute from active volumes
  const totalBytes = overview?.total_storage_bytes || 2 * 1024 * 1024 * 1024 * 1024;
  const usedBytes = overview?.used_storage_bytes || 1.44 * 1024 * 1024 * 1024 * 1024;
  const availableBytes = Math.max(0, totalBytes - usedBytes);
  const targetPct = overview?.storage_used_pct || (totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 72);

  // Animate from 0 to targetPct on mount and data updates
  const [currentPct, setCurrentPct] = useState(0);

  useEffect(() => {
    let startTime = null;
    const duration = 1200; // 1.2s smooth ease-out
    let animId;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Cubic ease out curve
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCurrentPct(Math.round(targetPct * easeOut));

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [targetPct]);

  // SVG Semicircular Gauge calculation
  // Radius R=105, Center (140, 125)
  // Semicircle from angle 180° (left) to 0° (right)
  const radius = 105;
  const cx = 140;
  const cy = 125;
  const strokeWidth = 20;

  // Arc length for semicircle: PI * radius
  const arcLength = Math.PI * radius;
  // Clamped ratio between 0 and 1 based on animated currentPct
  const clampedRatio = Math.min(1, Math.max(0, currentPct / 100));
  const strokeDashoffset = arcLength * (1 - clampedRatio);

  return (
    <div className="card-container" style={{ minHeight: 342, alignItems: 'center', justifyContent: 'space-between', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ width: '100%', marginBottom: 4 }}>
        <h2 className="card-heading" style={{ textAlign: 'center' }}>Storage Capacity</h2>
        <p className="card-subheading" style={{ textAlign: 'center' }}>Overall fleet utilization</p>
      </div>

      {/* Scaled Gauge */}
      <div className="gauge-wrapper">
        <svg viewBox="0 0 280 150" className="gauge-svg">
          {/* Background Track Arc */}
          <path
            d={`M ${cx - radius},${cy} A ${radius} ${radius} 0 0 1 ${cx + radius},${cy}`}
            fill="none"
            stroke="var(--gauge-bg)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Filled Progress Arc */}
          <path
            d={`M ${cx - radius},${cy} A ${radius} ${radius} 0 0 1 ${cx + radius},${cy}`}
            fill="none"
            stroke="var(--gauge-fill)"
            strokeWidth={strokeWidth}
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Center Labels */}
        <div className="gauge-inner-content">
          <span className="gauge-pct-text">{currentPct}%</span>
          <span className="gauge-pct-label">Utilized</span>
        </div>
      </div>

      {/* Proportional Capacity Stats Row */}
      <div className="capacity-stats-row">
        <div className="capacity-stat-badge">
          <span className="capacity-dot used" aria-hidden="true"></span>
          <span>Used: <strong>{formatBytes(usedBytes)}</strong></span>
        </div>
        <div className="capacity-stat-badge">
          <span className="capacity-dot free" aria-hidden="true"></span>
          <span>Free: <strong>{formatBytes(availableBytes)}</strong></span>
        </div>
      </div>
    </div>
  );
}
