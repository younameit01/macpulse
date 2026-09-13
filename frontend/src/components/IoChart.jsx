import React, { useState, useEffect, useId, useRef } from 'react';
import { Info } from 'lucide-react';
import { formatBps } from '../api';

function InfoTooltip({ title, content, width = 290, align = 'left' }) {
  const [open, setOpen] = useState(false);

  let positionStyles = {
    left: 0,
    right: 'auto',
    transform: 'none',
  };

  if (align === 'right') {
    positionStyles = {
      right: 0,
      left: 'auto',
      transform: 'none',
    };
  } else if (align === 'center') {
    positionStyles = {
      left: '50%',
      transform: 'translateX(-50%)',
    };
  }

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Info: ${typeof title === 'string' ? title : 'Telemetry details'}`}
        style={{
          background: 'none',
          border: 'none',
          padding: '2px 4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          color: open ? 'var(--chart-read)' : 'var(--text-dim)',
          transition: 'color 0.15s ease',
        }}
      >
        <Info size={14} />
      </button>

      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            ...positionStyles,
            width,
            maxWidth: 'calc(100vw - 36px)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-hover)',
            boxShadow: '0 14px 36px rgba(0, 0, 0, 0.22), 0 2px 8px rgba(0, 0, 0, 0.08)',
            borderRadius: 12,
            padding: '12px 14px',
            zIndex: 120,
            pointerEvents: 'none',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 5 }}>
            {title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

export default function IoChart({
  data = [],
  height = 210,
  title = 'Historical Throughput',
  subtitle = 'Read and write throughput over time',
  timeRange: controlledTimeRange,
  onTimeRangeChange,
  timeRanges = ['5 min', '15 min', '30 min', '1 hr'],
  infoTooltip,
  infoTitle,
}) {
  const [internalTimeRange, setInternalTimeRange] = useState('15 min');
  const activeTimeRange = controlledTimeRange || internalTimeRange;

  const [isAnimated, setIsAnimated] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);
  const chartContainerRef = useRef(null);

  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const writeGlowId = `io-writeGlow-${safeId}`;
  const readGlowId = `io-readGlow-${safeId}`;
  const clipId = `io-chartClip-${safeId}`;

  const handleTimeRangeClick = (t) => {
    if (onTimeRangeChange) {
      onTimeRangeChange(t);
    } else {
      setInternalTimeRange(t);
    }
  };

  // Re-trigger reveal animation on data updates or time range changes
  useEffect(() => {
    setIsAnimated(false);
    const timer = setTimeout(() => {
      setIsAnimated(true);
    }, 40);
    return () => clearTimeout(timer);
  }, [activeTimeRange, data?.length]);

  const width = 869;
  const padX = 20;
  const padY = 24;

  const hasData = Array.isArray(data) && data.length > 0;

  // Max value calculation
  const maxVal = Math.max(
    ...(hasData ? data.map((d) => Math.max(d.read_bps || 0, d.write_bps || 0)) : [0]),
    1024 * 1024 // at least 1 MB/s ceiling
  );

  const getX = (idx, total) => {
    if (total <= 1) return padX;
    return padX + (idx / (total - 1)) * (width - 2 * padX);
  };

  const getY = (val) => {
    const clamped = Math.max(0, val || 0);
    const ratio = clamped / maxVal;
    return height - padY - ratio * (height - 2 * padY);
  };

  // Helper to generate smooth SVG cubic bezier path matching FleetIoCard
  const buildSmoothPath = (pts) => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i !== pts.length - 2 ? pts[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  };

  const readCoords = hasData
    ? data.map((d, i) => ({
        x: getX(i, data.length),
        y: getY(d.read_bps),
      }))
    : [];

  const writeCoords = hasData
    ? data.map((d, i) => ({
        x: getX(i, data.length),
        y: getY(d.write_bps),
      }))
    : [];

  const readPath = buildSmoothPath(readCoords);
  const writePath = buildSmoothPath(writeCoords);

  // Latest or currently hovered values for the legend
  const activeIndex = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.length
    ? hoverIndex
    : (hasData ? data.length - 1 : null);

  const currentRead = activeIndex !== null ? data[activeIndex]?.read_bps || 0 : 0;
  const currentWrite = activeIndex !== null ? data[activeIndex]?.write_bps || 0 : 0;
  const activePoint = activeIndex !== null ? data[activeIndex] : null;

  // Handle interactive hover over chart canvas
  const handleMouseMove = (e) => {
    if (!hasData || data.length < 2 || !chartContainerRef.current) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clientX / rect.width));
    const index = Math.round(ratio * (data.length - 1));
    setHoverIndex(index);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const formatPointTime = (ts) => {
    if (!ts) return '';
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header Row: Title, Subtitle, and Time Filter Group */}
      <div className="card-header-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <h2 className="card-heading" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              {title}
            </h2>
            {(infoTooltip || title === 'Host I/O Activity') && (
              <InfoTooltip
                title={infoTitle || title}
                content={
                  infoTooltip ||
                  "Continuous host-level storage telemetry tracking total read and write throughput in real time across all mounted APFS, HFS+, and network storage volumes."
                }
                width={290}
                align="left"
              />
            )}
          </div>
          {subtitle && <p className="card-subheading" style={{ marginTop: 2 }}>{subtitle}</p>}
        </div>

        {/* Time range buttons */}
        {timeRanges && timeRanges.length > 0 && (
          <div className="time-filter-group" role="group" aria-label="Chart time range">
            {timeRanges.map((t) => (
              <button
                key={t}
                className={`time-btn ${activeTimeRange === t ? 'active' : ''}`}
                onClick={() => handleTimeRangeClick(t)}
                type="button"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Legend & Hover Telemetry Indicator */}
      <div
        className="chart-legend"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: 28,
          flexWrap: 'nowrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: 'var(--chart-read)' }}></span>
            <span>Read</span>
            <span className="mono-text" style={{ minWidth: 64, fontVariantNumeric: 'tabular-nums' }}>
              {formatBps(currentRead)}
            </span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: 'var(--chart-write)' }}></span>
            <span>Write</span>
            <span className="mono-text" style={{ minWidth: 64, fontVariantNumeric: 'tabular-nums' }}>
              {formatBps(currentWrite)}
            </span>
          </div>
        </div>

        <span
          className="mono-text"
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            backgroundColor: 'var(--bg-subtle)',
            padding: '3px 8px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            visibility: activePoint && hoverIndex !== null ? 'visible' : 'hidden',
            opacity: activePoint && hoverIndex !== null ? 1 : 0,
            transition: 'opacity 0.12s ease',
            pointerEvents: 'none',
          }}
        >
          Sample: {activePoint ? formatPointTime(activePoint.timestamp || activePoint.time) : '--:--:--'}
        </span>
      </div>

      {/* Chart Canvas Area */}
      <div
        ref={chartContainerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          width: '100%',
          height,
          position: 'relative',
          cursor: hasData ? 'crosshair' : 'default',
        }}
      >
        {/* Y-Axis Value Labels overlay (sharp, non-distorted HTML badges) */}
        <div
          style={{
            position: 'absolute',
            left: 2,
            top: 2,
            bottom: 6,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            zIndex: 2,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-dim)',
          }}
        >
          <span style={{ opacity: 0.85 }}>{formatBps(maxVal)}</span>
          <span style={{ opacity: 0.7 }}>{formatBps(maxVal / 2)}</span>
          <span style={{ opacity: 0.85 }}>0 B/s</span>
        </div>

        {!hasData ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-dim)',
              fontSize: 13,
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            No historical samples available for this time window
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={writeGlowId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-write)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--chart-write)" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id={readGlowId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-read)" stopOpacity="0.14" />
                <stop offset="100%" stopColor="var(--chart-read)" stopOpacity="0.0" />
              </linearGradient>

              {/* Sweep reveal animation clip path matching FleetIoCard */}
              <clipPath id={clipId}>
                <rect
                  x="0"
                  y="0"
                  width={isAnimated ? width : 0}
                  height={height}
                  style={{
                    transition: 'width 1.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </clipPath>
            </defs>

            {/* Subtle horizontal gridlines spanning the full width */}
            <line
              x1={padX}
              y1={padY}
              x2={width - padX}
              y2={padY}
              stroke="var(--chart-grid)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <line
              x1={padX}
              y1={height / 2}
              x2={width - padX}
              y2={height / 2}
              stroke="var(--chart-grid)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <line
              x1={padX}
              y1={height - padY}
              x2={width - padX}
              y2={height - padY}
              stroke="var(--chart-grid)"
              strokeWidth="1"
            />

            {/* Animated curves and ambient glowing fills */}
            <g clipPath={`url(#${clipId})`}>
              {/* Gradient glow fill under write curve */}
              {writeCoords.length > 1 && (
                <path
                  d={`${writePath} L ${writeCoords[writeCoords.length - 1].x},${height - padY} L ${writeCoords[0].x},${height - padY} Z`}
                  fill={`url(#${writeGlowId})`}
                />
              )}

              {/* Gradient glow fill under read curve */}
              {readCoords.length > 1 && (
                <path
                  d={`${readPath} L ${readCoords[readCoords.length - 1].x},${height - padY} L ${readCoords[0].x},${height - padY} Z`}
                  fill={`url(#${readGlowId})`}
                />
              )}

              {/* Read curve (smooth cubic Bezier) */}
              {readPath && (
                <path
                  d={readPath}
                  fill="none"
                  stroke="var(--chart-read)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength="1"
                  strokeDasharray="1"
                  strokeDashoffset={isAnimated ? 0 : 1}
                  style={{
                    transition: 'stroke-dashoffset 1.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              )}

              {/* Write curve (smooth cubic Bezier) */}
              {writePath && (
                <path
                  d={writePath}
                  fill="none"
                  stroke="var(--chart-write)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength="1"
                  strokeDasharray="1"
                  strokeDashoffset={isAnimated ? 0 : 1}
                  style={{
                    transition: 'stroke-dashoffset 1.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              )}

              {/* Latest endpoint markers */}
              {readCoords.length > 0 && (
                <circle
                  cx={readCoords[readCoords.length - 1].x}
                  cy={readCoords[readCoords.length - 1].y}
                  r="4.5"
                  fill="var(--chart-read)"
                  style={{
                    transition: 'opacity 0.3s ease 1.0s',
                    opacity: isAnimated ? 1 : 0,
                  }}
                />
              )}
              {writeCoords.length > 0 && (
                <circle
                  cx={writeCoords[writeCoords.length - 1].x}
                  cy={writeCoords[writeCoords.length - 1].y}
                  r="4.5"
                  fill="var(--chart-write)"
                  style={{
                    transition: 'opacity 0.3s ease 1.0s',
                    opacity: isAnimated ? 1 : 0,
                  }}
                />
              )}
            </g>

            {/* Interactive hover crosshair and tracking points */}
            {hoverIndex !== null && readCoords[hoverIndex] && writeCoords[hoverIndex] && (
              <g>
                {/* Vertical tracking indicator */}
                <line
                  x1={readCoords[hoverIndex].x}
                  y1={padY}
                  x2={readCoords[hoverIndex].x}
                  y2={height - padY}
                  stroke="var(--border-hover)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />

                {/* Read focus marker */}
                <circle
                  cx={readCoords[hoverIndex].x}
                  cy={readCoords[hoverIndex].y}
                  r="6"
                  fill="var(--bg-card)"
                  stroke="var(--chart-read)"
                  strokeWidth="2.5"
                />

                {/* Write focus marker */}
                <circle
                  cx={writeCoords[hoverIndex].x}
                  cy={writeCoords[hoverIndex].y}
                  r="6"
                  fill="var(--bg-card)"
                  stroke="var(--chart-write)"
                  strokeWidth="2.5"
                />
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
