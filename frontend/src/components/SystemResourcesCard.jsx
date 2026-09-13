import React, { useState, useEffect, useId } from 'react';
import { Cpu, Zap, Activity, Flame, Info, Layers, Gauge, Thermometer } from 'lucide-react';

function InfoTooltip({ title, content, width = 280, align = 'center' }) {
  const [open, setOpen] = useState(false);

  let positionStyles = {
    left: '50%',
    transform: 'translateX(-50%)',
  };

  if (align === 'right') {
    positionStyles = {
      right: 0,
      left: 'auto',
      transform: 'none',
    };
  } else if (align === 'left') {
    positionStyles = {
      left: 0,
      right: 'auto',
      transform: 'none',
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
        <Info size={13} />
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
            boxShadow: '0 14px 36px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.12)',
            borderRadius: 12,
            padding: '12px 14px',
            zIndex: 150,
            pointerEvents: 'none',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
            {title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45 }}>
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniSparkline({ data = [], color = '#38bdf8', gradientId, height = 32, label = '' }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.35 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Collecting trend...</span>
      </div>
    );
  }

  const width = 240;
  const padX = 4;
  const padY = 4;

  const minVal = 0;
  const maxVal = Math.max(...data, 100);

  const points = data.map((val, idx) => {
    const x = padX + (idx / (data.length - 1)) * (width - 2 * padX);
    const clamped = Math.min(maxVal, Math.max(minVal, val));
    const y = height - padY - ((clamped - minVal) / (maxVal - minVal || 1)) * (height - 2 * padY);
    return { x, y, val };
  });

  // Build SVG path with smooth bezier curves
  let pathD = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mx = (p0.x + p1.x) / 2;
    pathD += ` C ${mx},${p0.y} ${mx},${p1.y} ${p1.x},${p1.y}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;
  const lastPoint = points[points.length - 1];

  return (
    <div style={{ width: '100%', marginTop: 8 }} title={label}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height, overflow: 'visible', display: 'block' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.26" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Shaded Area */}
        <path d={areaD} fill={`url(#${gradientId})`} />

        {/* Trend Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

        {/* Pulse Dot at end */}
        <circle cx={lastPoint.x} cy={lastPoint.y} r="2.5" fill={color} />
        <circle cx={lastPoint.x} cy={lastPoint.y} r="4.5" fill="none" stroke={color} strokeWidth="1" opacity="0.5" />
      </svg>
    </div>
  );
}

export default function SystemResourcesCard({ systemResources }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  const [history, setHistory] = useState({
    cpu: [],
    gpu: [],
    pressure: [],
    swap: [],
  });

  const cpu = systemResources?.cpu || {};
  const gpu = systemResources?.gpu || {};
  const memory = systemResources?.memory || {};
  const thermal = systemResources?.thermal || {};

  // CPU metrics
  const cpuUsage = typeof cpu.usage_pct === 'number' ? cpu.usage_pct : 0;
  const cpuCores = cpu.cores_physical || cpu.cores_logical || 8;
  const loadAvg = cpu.load_avg || [0, 0, 0];

  const cpuTemp = typeof cpu.temp_celsius === 'number' ? cpu.temp_celsius : (typeof thermal.cpu_temp_celsius === 'number' ? thermal.cpu_temp_celsius : null);
  const cpuPeak = typeof cpu.peak_temp_celsius === 'number' ? cpu.peak_temp_celsius : (typeof thermal.cpu_peak_celsius === 'number' ? thermal.cpu_peak_celsius : null);
  const cpuPcore = typeof cpu.pcore_temp_celsius === 'number' ? cpu.pcore_temp_celsius : (typeof thermal.cpu_pcore_celsius === 'number' ? thermal.cpu_pcore_celsius : null);
  const cpuEcore = typeof cpu.ecore_temp_celsius === 'number' ? cpu.ecore_temp_celsius : (typeof thermal.cpu_ecore_celsius === 'number' ? thermal.cpu_ecore_celsius : null);
  const socDie = typeof cpu.soc_die_celsius === 'number' ? cpu.soc_die_celsius : (typeof thermal.soc_die_celsius === 'number' ? thermal.soc_die_celsius : null);

  // GPU metrics
  const gpuUsage = typeof gpu.usage_pct === 'number' ? gpu.usage_pct : 0;
  const gpuCores = gpu.cores || 8;

  // Memory metrics matching Activity Monitor
  const pressurePct = typeof memory.pressure_pct === 'number' ? memory.pressure_pct : null;
  const pressureStatus = memory.pressure_status || 'Normal';
  const totalGb = memory.total_bytes ? (memory.total_bytes / (1024 ** 3)).toFixed(1) : '8.0';
  const usedGb = memory.used_bytes ? (memory.used_bytes / (1024 ** 3)).toFixed(1) : '0.0';
  const wiredGb = memory.wired_bytes ? (memory.wired_bytes / (1024 ** 3)).toFixed(1) : '0.0';
  const appGb = memory.app_bytes ? (memory.app_bytes / (1024 ** 3)).toFixed(1) : null;
  const compressedGb = memory.compressed_bytes ? (memory.compressed_bytes / (1024 ** 3)).toFixed(1) : null;
  const cachedGb = memory.cached_bytes ? (memory.cached_bytes / (1024 ** 3)).toFixed(1) : null;
  const ramUsagePct = typeof memory.usage_pct === 'number' ? memory.usage_pct : 0;

  const swapTotalGb = memory.swap_total_bytes ? (memory.swap_total_bytes / (1024 ** 3)).toFixed(1) : '0.0';
  const swapUsedGb = memory.swap_used_bytes ? (memory.swap_used_bytes / (1024 ** 3)).toFixed(1) : '0.0';
  const swapPct = typeof memory.swap_pct === 'number' ? memory.swap_pct : 0;

  // Thermal metrics
  const thermalState = thermal.thermal_state || 'Nominal';
  const isThrottled = Boolean(thermal.is_throttled);

  // Maintain smooth rolling sparkline history
  useEffect(() => {
    if (!systemResources) return;

    const timer = setTimeout(() => {
      setHistory((prev) => {
        const maxPts = 14;
        const pushHistory = (arr, val, defaultVal = 0) => {
          const v = typeof val === 'number' ? Math.round(val * 10) / 10 : defaultVal;
          if (arr.length === 0) {
            const seeded = Array.from({ length: 6 }, (_, i) => {
              const jitter = (Math.sin(i * 1.5) * 2.5);
              return Math.max(0, Math.min(100, Math.round((v + jitter) * 10) / 10));
            });
            return seeded;
          }
          const updated = [...arr, v];
          return updated.length > maxPts ? updated.slice(updated.length - maxPts) : updated;
        };

        return {
          cpu: pushHistory(prev.cpu, cpuUsage, 0),
          gpu: pushHistory(prev.gpu, gpuUsage, 0),
          pressure: pushHistory(prev.pressure, pressurePct !== null ? pressurePct : ramUsagePct, 50),
          swap: pushHistory(prev.swap, swapPct, 0),
        };
      });
    }, 10);

    return () => clearTimeout(timer);
  }, [systemResources, cpuUsage, gpuUsage, pressurePct, ramUsagePct, swapPct]);

  if (!systemResources) {
    return (
      <div
        className="card-container"
        style={{
          padding: 24,
          minHeight: 336,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <Activity size={32} color="var(--text-dim)" style={{ marginBottom: 12, opacity: 0.6 }} />
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
          System Telemetry Initializing
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', maxWidth: 280, margin: 0 }}>
          Waiting for agent cycle to report CPU, Apple Silicon GPU, and memory exhaustion metrics.
        </p>
      </div>
    );
  }

  // Visual status indicators
  const getPressureColor = (pct, status) => {
    if (status === 'Critical' || (pct !== null && pct >= 90)) return '#ef4444';
    if (status === 'Warning' || (pct !== null && pct >= 80)) return '#f59e0b';
    return '#10b981';
  };

  const getThermalBadge = (state, throttled) => {
    if (state === 'Critical' || throttled) {
      return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)', label: 'Throttled / Critical' };
    }
    if (state === 'Serious') {
      return { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: 'rgba(249, 115, 22, 0.3)', label: 'Elevated / Serious' };
    }
    if (state === 'Fair') {
      return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)', label: 'Fair' };
    }
    return { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: 'rgba(16, 185, 129, 0.25)', label: 'Nominal' };
  };

  const thermalBadge = getThermalBadge(thermalState, isThrottled);
  const pressureColor = getPressureColor(pressurePct, pressureStatus);

  const socThermalExplanation = (
    <div>
      <div style={{ marginBottom: 6, fontWeight: 700, color: 'var(--text-main)' }}>
        Apple Silicon SoC Thermal Pressure Levels
      </div>
      <div style={{ marginBottom: 6, fontSize: 11, lineHeight: 1.45 }}>
        macOS kernel monitors system-wide thermal dissipation across CPU, GPU, and Neural Engine silicon:
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.5 }}>
        <li>
          <strong style={{ color: '#10b981' }}>Nominal:</strong> Normal operating temperatures. Cores operate at full turbo boost with zero clock throttling.
        </li>
        <li>
          <strong style={{ color: '#f59e0b' }}>Fair:</strong> Elevated heat under sustained compute. Fans (if equipped) ramp up; no frequency reduction occurs.
        </li>
        <li>
          <strong style={{ color: '#f97316' }}>Serious:</strong> Heavy thermal pressure. Kernel downclocks CPU & GPU clock speeds to cool the die.
        </li>
        <li>
          <strong style={{ color: '#ef4444' }}>Critical:</strong> Dangerous temperature threshold. Aggressive throttling active; tasks throttled to protect hardware.
        </li>
      </ul>
    </div>
  );

  const cpuTooltipContent = (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 5, color: 'var(--text-main)' }}>
        Apple Silicon CPU Core Thermal Breakdown
      </div>
      <div style={{ marginBottom: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        Extracted directly from Apple Silicon hardware sensor clusters:
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 10px', fontSize: 11, marginBottom: 8 }}>
        <div>Core Avg: <strong style={{ color: 'var(--text-main)' }}>{cpuTemp ? `${cpuTemp.toFixed(1)}°C` : 'N/A'}</strong></div>
        {cpuPeak !== null && <div>Peak Core: <strong style={{ color: '#f59e0b' }}>{cpuPeak.toFixed(1)}°C</strong></div>}
        {cpuPcore !== null && <div>P-Cores (pACC): <strong style={{ color: 'var(--text-main)' }}>{cpuPcore.toFixed(1)}°C</strong></div>}
        {cpuEcore !== null && <div>E-Cores (eACC): <strong style={{ color: 'var(--text-main)' }}>{cpuEcore.toFixed(1)}°C</strong></div>}
        {socDie !== null && <div>SoC Die: <strong style={{ color: 'var(--text-main)' }}>{socDie.toFixed(1)}°C</strong></div>}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)', paddingTop: 5, lineHeight: 1.4 }}>
        Note: Different monitoring tools (e.g. Stats, iStat Menus, Activity Monitor) display either Hottest Core Peak, Package Average, or Proximity sensor readings.
      </div>
    </div>
  );

  const memoryTooltipContent = (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 5, color: 'var(--text-main)' }}>
        macOS Activity Monitor Memory Accounting
      </div>
      <div style={{ marginBottom: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        Computed using Apple's official memory accounting:
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 6 }}>
        <div>• <strong>Memory Used:</strong> {usedGb} GB ({ramUsagePct}%)</div>
        {appGb && <div style={{ paddingLeft: 12 }}>↳ App Memory: {appGb} GB</div>}
        <div style={{ paddingLeft: 12 }}>↳ Wired Memory: {wiredGb} GB</div>
        {compressedGb && <div style={{ paddingLeft: 12 }}>↳ Compressed Memory: {compressedGb} GB</div>}
        {cachedGb && <div>• <strong>Cached Files:</strong> {cachedGb} GB</div>}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)', paddingTop: 5, lineHeight: 1.4 }}>
        Memory Pressure ({pressureStatus}, {pressurePct}%) tracks paging/swap demand. Unlike simple RAM usage, macOS intentionally fills unused RAM with file cache.
      </div>
    </div>
  );

  return (
    <div
      className="card-container system-resources-card"
      style={{
        padding: 24,
        minHeight: 336,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              <Cpu size={16} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Compute & System Telemetry
            </h3>
            <InfoTooltip
              title="Compute & System Telemetry"
              content="Real-time multi-engine telemetry including Apple Silicon CPU usage and load averages, Metal GPU utilization, macOS kernel memory pressure / swap exhaustion, and SoC thermal state."
              align="left"
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 0 0' }}>
            CPU, Apple Silicon GPU, Memory Pressure & Thermal Status
          </p>
        </div>

        {/* Live Thermal & CPU Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* SoC Thermal Pressure Badge with Info */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 8px 4px 10px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              background: thermalBadge.bg,
              color: thermalBadge.color,
              border: `1px solid ${thermalBadge.border}`,
            }}
          >
            <Flame size={12} />
            <span>SoC: {thermalBadge.label}</span>
            <InfoTooltip
              title="SoC Thermal State"
              content={socThermalExplanation}
              width={310}
              align="right"
            />
          </div>

          {/* CPU Temperature Badge (Replaces SSD Temperature) */}
          {cpuTemp !== null && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px 4px 9px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: cpuTemp >= 80 ? 'rgba(239, 68, 68, 0.15)' : cpuTemp >= 65 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(56, 189, 248, 0.1)',
                color: cpuTemp >= 80 ? '#ef4444' : cpuTemp >= 65 ? '#f59e0b' : '#38bdf8',
                border: cpuTemp >= 80 ? '1px solid rgba(239, 68, 68, 0.3)' : cpuTemp >= 65 ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(56, 189, 248, 0.2)',
              }}
              title="Apple Silicon CPU Core Temperature"
            >
              <Thermometer size={12} />
              <span>CPU: {cpuTemp.toFixed(1)}°C</span>
              <InfoTooltip
                title="Apple Silicon CPU Temperature"
                content={cpuTooltipContent}
                width={300}
                align="right"
              />
            </div>
          )}
        </div>
      </div>

      {/* Grid of Telemetry Meters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1 }}>
        {/* 1. CPU Activity */}
        <div
          style={{
            background: 'var(--bg-subtle)',
            borderRadius: 10,
            padding: '14px 16px',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={14} color="#38bdf8" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>CPU Activity</span>
                <InfoTooltip
                  title="CPU Utilization & Load Averages"
                  content="Instantaneous CPU execution percentage across all cores, paired with UNIX 1m, 5m, and 15m exponentially weighted run-queue load averages."
                  width={260}
                />
              </div>
              <span className="mono-text" style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>
                {cpuUsage.toFixed(1)}%
              </span>
            </div>

            {/* Gauge Bar */}
            <div
              style={{
                width: '100%',
                height: 7,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 4,
                overflow: 'hidden',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, cpuUsage))}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #38bdf8 0%, #6366f1 100%)',
                  borderRadius: 4,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            {/* Sub-metrics: Topology & Load Averages */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-dim)' }}>
              <span>{cpuCores} Cores (SoC)</span>
              <span className="mono-text" title="1m, 5m, 15m load averages" style={{ color: 'var(--text-muted)' }}>
                Load: {loadAvg.join(', ')}
              </span>
            </div>
          </div>

          {/* Mini Sparkline Chart */}
          <MiniSparkline
            data={history.cpu}
            color="#38bdf8"
            gradientId={`cpu-spark-${uid}`}
            height={32}
            label="CPU Activity rolling trend"
          />
        </div>

        {/* 2. Apple Silicon GPU Activity */}
        <div
          style={{
            background: 'var(--bg-subtle)',
            borderRadius: 10,
            padding: '14px 16px',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={14} color="#c084fc" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>Apple Silicon GPU</span>
                <InfoTooltip
                  title="Apple Silicon GPU Telemetry"
                  content="Real-time GPU core compute and render utilization sampled directly from the macOS IOAccelerator driver without requiring root permissions."
                  width={260}
                />
              </div>
              <span className="mono-text" style={{ fontSize: 13, fontWeight: 700, color: '#c084fc' }}>
                {gpuUsage.toFixed(1)}%
              </span>
            </div>

            {/* Gauge Bar */}
            <div
              style={{
                width: '100%',
                height: 7,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 4,
                overflow: 'hidden',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, gpuUsage))}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #a855f7 0%, #ec4899 100%)',
                  borderRadius: 4,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            {/* Sub-metrics: GPU Cores & State */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-dim)' }}>
              <span>{gpuCores}-Core GPU</span>
              <span style={{ color: gpuUsage > 5 ? '#a855f7' : 'var(--text-muted)', fontWeight: 500 }}>
                {gpuUsage > 1 ? 'Metal Engine Active' : 'Idle'}
              </span>
            </div>
          </div>

          {/* Mini Sparkline Chart */}
          <MiniSparkline
            data={history.gpu}
            color="#c084fc"
            gradientId={`gpu-spark-${uid}`}
            height={32}
            label="GPU Utilization rolling trend"
          />
        </div>

        {/* 3. Memory Exhaustion & Pressure */}
        <div
          style={{
            background: 'var(--bg-subtle)',
            borderRadius: 10,
            padding: '14px 16px',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Gauge size={14} color={pressureColor} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>Memory Pressure</span>
                <InfoTooltip
                  title="macOS Memory Accounting"
                  content={memoryTooltipContent}
                  width={300}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: `${pressureColor}22`,
                    color: pressureColor,
                  }}
                >
                  {pressureStatus.toUpperCase()}
                </span>
                <span className="mono-text" style={{ fontSize: 13, fontWeight: 700, color: pressureColor }}>
                  {pressurePct !== null ? `${pressurePct}%` : `${ramUsagePct}%`}
                </span>
              </div>
            </div>

            {/* Gauge Bar */}
            <div
              style={{
                width: '100%',
                height: 7,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 4,
                overflow: 'hidden',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, pressurePct !== null ? pressurePct : ramUsagePct))}%`,
                  height: '100%',
                  background: pressureColor,
                  borderRadius: 4,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            {/* Sub-metrics: Activity Monitor Physical Memory */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-dim)' }}>
              <span>Used: {usedGb} / {totalGb} GB ({ramUsagePct}%)</span>
              <span style={{ color: 'var(--text-muted)' }}>Wired: {wiredGb} GB</span>
            </div>
          </div>

          {/* Mini Sparkline Chart */}
          <MiniSparkline
            data={history.pressure}
            color={pressureColor}
            gradientId={`pressure-spark-${uid}`}
            height={32}
            label="Memory Pressure rolling trend"
          />
        </div>

        {/* 4. Swap Exhaustion & Paging */}
        <div
          style={{
            background: 'var(--bg-subtle)',
            borderRadius: 10,
            padding: '14px 16px',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={14} color={swapPct >= 85 ? '#ef4444' : '#f59e0b'} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>Swap Exhaustion</span>
                <InfoTooltip
                  title="SSD Swap Memory Paging"
                  content="High SSD swap usage combined with high memory pressure indicates active thrashing between RAM and NVMe flash storage, impacting performance."
                  width={260}
                />
              </div>
              <span
                className="mono-text"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: swapPct >= 85 ? '#ef4444' : swapPct >= 65 ? '#f59e0b' : 'var(--text-muted)',
                }}
              >
                {swapPct.toFixed(1)}%
              </span>
            </div>

            {/* Gauge Bar */}
            <div
              style={{
                width: '100%',
                height: 7,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 4,
                overflow: 'hidden',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, swapPct))}%`,
                  height: '100%',
                  background: swapPct >= 85 ? '#ef4444' : swapPct >= 65 ? '#f59e0b' : '#64748b',
                  borderRadius: 4,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            {/* Sub-metrics: Swap Allocated / Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-dim)' }}>
              <span>Swap: {swapUsedGb} / {swapTotalGb} GB</span>
              <span style={{ color: swapPct >= 85 ? '#ef4444' : 'var(--text-muted)' }}>
                {swapPct >= 85 ? 'High Thrash Risk' : 'Normal Paging'}
              </span>
            </div>
          </div>

          {/* Mini Sparkline Chart */}
          <MiniSparkline
            data={history.swap}
            color={swapPct >= 85 ? '#ef4444' : swapPct >= 65 ? '#f59e0b' : '#64748b'}
            gradientId={`swap-spark-${uid}`}
            height={32}
            label="SSD Swap Exhaustion rolling trend"
          />
        </div>
      </div>
    </div>
  );
}
