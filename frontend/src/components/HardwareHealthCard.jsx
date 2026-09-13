import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Cpu, Flame, HardDrive, Zap, Info } from 'lucide-react';

function InfoTooltip({ title, content, width = 290, align = 'center' }) {
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
        aria-label={`Info: ${title}`}
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

export default function HardwareHealthCard({ diskHealth }) {
  if (!diskHealth) {
    return (
      <div className="card-container" style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
          <HardDrive size={18} />
          <span style={{ fontSize: 13 }}>Hardware S.M.A.R.T. telemetry awaiting agent cycle...</span>
        </div>
      </div>
    );
  }

  const {
    smart_status = 'Unknown',
    ssd_wear_pct,
    temp_celsius,
    available_spare_pct,
    available_spare_threshold_pct,
    media_errors = 0,
    total_tb_written = 0,
    total_tb_read = 0,
    power_on_hours,
    unsafe_shutdowns,
    bus_protocol = 'Apple Fabric',
    device_node,
    volume_name,
  } = diskHealth;

  const isSmartVerified = (smart_status || '').toLowerCase() === 'verified';
  
  // Temperature evaluation
  let tempColor = 'var(--alert-green-text)';
  let tempLabel = 'Optimal';
  if (temp_celsius !== null && temp_celsius !== undefined) {
    if (temp_celsius >= 75) {
      tempColor = 'var(--alert-crit-border)';
      tempLabel = 'Critical Throttling';
    } else if (temp_celsius >= 65) {
      tempColor = 'var(--alert-warn-border)';
      tempLabel = 'Warm / Heavy I/O';
    } else if (temp_celsius >= 55) {
      tempColor = 'var(--chart-read)';
      tempLabel = 'Moderate';
    }
  }

  // SSD Wear evaluation
  let wearColor = 'var(--alert-green-text)';
  if (ssd_wear_pct !== null && ssd_wear_pct !== undefined) {
    if (ssd_wear_pct >= 90) wearColor = 'var(--alert-crit-border)';
    else if (ssd_wear_pct >= 80) wearColor = 'var(--alert-warn-border)';
  }

  // Available Spare evaluation
  let spareColor = 'var(--alert-green-text)';
  let spareLabel = 'Healthy';
  const spareThresh = available_spare_threshold_pct || 20;
  if (available_spare_pct !== null && available_spare_pct !== undefined) {
    if (available_spare_pct <= spareThresh || available_spare_pct <= 20) {
      spareColor = 'var(--alert-crit-border)';
      spareLabel = 'Critical Reserve';
    } else if (available_spare_pct <= 60) {
      spareColor = 'var(--alert-warn-border)';
      spareLabel = 'Degraded';
    }
  }

  const remainingLifePct = ssd_wear_pct !== null && ssd_wear_pct !== undefined ? Math.max(0, 100 - ssd_wear_pct) : null;

  return (
    <div className="card-container" style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            padding: 10,
            borderRadius: 12,
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Cpu size={20} color="var(--chart-read)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Hardware & S.M.A.R.T. Health
              </h3>
              <InfoTooltip
                title="Hardware S.M.A.R.T. Observability"
                content="Continuous hardware self-monitoring directly querying the drive's micro-controller firmware. Tracks NAND flash endurance, thermal states, and failure prediction before data loss occurs."
                align="left"
              />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
              Physical NVMe SSD endurance, controller thermal state, and NAND reliability
            </p>
          </div>
        </div>

        {/* SMART Status Badge & Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            className="badge"
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              background: isSmartVerified ? 'rgba(16, 185, 129, 0.12)' : 'rgba(219, 51, 46, 0.12)',
              color: isSmartVerified ? 'var(--alert-green-text)' : 'var(--alert-crit-border)',
              border: isSmartVerified ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(219, 51, 46, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {isSmartVerified ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
            S.M.A.R.T. {smart_status}
          </span>
          <InfoTooltip
            title="S.M.A.R.T. Status Indicators"
            content={(
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div><strong>Verified:</strong> Drive passed all internal diagnostics and reserve flash blocks are healthy.</div>
                <div><strong>Failing:</strong> Imminent hardware failure detected (spare blocks exhausted or critical write errors). Back up data immediately!</div>
                <div><strong>Fatal:</strong> Drive controller suffered unrecoverable hardware failure.</div>
                <div><strong>Not Supported:</strong> Volume does not support SMART passthrough (e.g. NFS / USB thumb drive).</div>
              </div>
            )}
            width={310}
            align="right"
          />
        </div>
      </div>

      {/* 4 Metric Columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 14,
        marginBottom: 16,
      }}>
        {/* Metric 1: SSD Wear */}
        <div style={{
          background: 'var(--bg-subtle)',
          borderRadius: 14,
          padding: '16px 18px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>SSD Endurance Used</span>
              <InfoTooltip
                title="SSD Endurance Wear (PERCENTAGE_USED)"
                content="Estimated percentage of total drive lifetime endurance consumed based on total bytes written versus manufacturer specifications. Reaching 100% means write endurance is fully exhausted."
                width={280}
                align="left"
              />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: wearColor }}>
              {remainingLifePct !== null ? `${remainingLifePct}% Life Left` : '--'}
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {ssd_wear_pct !== null && ssd_wear_pct !== undefined ? `${ssd_wear_pct}%` : 'N/A'}
          </div>
          {/* Progress bar */}
          <div style={{
            width: '100%',
            height: 6,
            borderRadius: 3,
            background: 'var(--border-subtle)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(100, Math.max(0, ssd_wear_pct || 0))}%`,
              height: '100%',
              backgroundColor: wearColor,
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            NAND flash degradation indicator
          </span>
        </div>

        {/* Metric 2: Temperature */}
        <div style={{
          background: 'var(--bg-subtle)',
          borderRadius: 14,
          padding: '16px 18px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Drive Temperature</span>
              <InfoTooltip
                title="NVMe Flash Controller Temperature"
                content="Real-time thermal reading of the flash controller. Normal operation is 30°C–60°C. Above 75°C, the controller throttles write speeds to protect the silicon, causing severe AI pipeline latency."
                width={280}
                align="center"
              />
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 6,
              background: 'var(--bg-card)',
              color: tempColor,
              border: '1px solid var(--border-subtle)',
            }}>
              {tempLabel}
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
            {temp_celsius !== null && temp_celsius !== undefined ? `${temp_celsius}°C` : 'N/A'}
            <Flame size={18} color={tempColor} />
          </div>
          <div style={{
            width: '100%',
            height: 6,
            borderRadius: 3,
            background: 'var(--border-subtle)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(100, Math.max(0, ((temp_celsius || 30) - 20) / (85 - 20) * 100))}%`,
              height: '100%',
              backgroundColor: tempColor,
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Throttle threshold: ~75°C
          </span>
        </div>

        {/* Metric 3: Reserve Spare */}
        <div style={{
          background: 'var(--bg-subtle)',
          borderRadius: 14,
          padding: '16px 18px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Available Spare</span>
              <InfoTooltip
                title="Available NAND Spare Blocks"
                content="Percentage of factory reserve flash blocks remaining. As flash memory cells wear out, the drive retires bad blocks and transparently swaps in spares. 100% indicates full spare capacity."
                width={280}
                align="center"
              />
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 6,
              background: 'var(--bg-card)',
              color: spareColor,
              border: '1px solid var(--border-subtle)',
            }}>
              {spareLabel}
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {available_spare_pct !== null && available_spare_pct !== undefined ? `${available_spare_pct}%` : '100%'}
          </div>
          <div style={{
            width: '100%',
            height: 6,
            borderRadius: 3,
            background: 'var(--border-subtle)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(100, Math.max(0, available_spare_pct || 100))}%`,
              height: '100%',
              backgroundColor: spareColor,
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Threshold: {available_spare_threshold_pct ? `${available_spare_threshold_pct}%` : '20%'} reserve
          </span>
        </div>

        {/* Metric 4: Total Lifetime Written */}
        <div style={{
          background: 'var(--bg-subtle)',
          borderRadius: 14,
          padding: '16px 18px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Lifetime Written</span>
              <InfoTooltip
                title="Lifetime Terabytes Written (TBW)"
                content="Cumulative volume written to flash storage across its operating life. Vital for monitoring write amplification caused by AI model training checkpoints, tensor downloads, and swap activity."
                width={290}
                align="right"
              />
            </div>
            <Zap size={14} color="var(--chart-write)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {total_tb_written ? `${total_tb_written} TB` : '--'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>Read: <strong style={{ color: 'var(--text-main)' }}>{total_tb_read || 0} TB</strong></span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Cumulative NVMe write volume
          </span>
        </div>
      </div>

      {/* Hardware Details Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        paddingTop: 14,
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 12,
        color: 'var(--text-muted)',
      }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Bus: <strong style={{ color: 'var(--text-main)' }}>{bus_protocol}</strong></span>
            <InfoTooltip
              title="Storage Interconnect Protocol"
              content="Apple Fabric connects unified Apple Silicon architecture directly to internal NVMe flash controllers. Other buses include Thunderbolt and external PCIe enclosures."
              width={260}
              align="left"
            />
          </div>
          {device_node && (
            <span>Node: <code className="mono-text" style={{ fontSize: 11 }}>{device_node}</code></span>
          )}
          {volume_name && (
            <span>Volume: <strong style={{ color: 'var(--text-main)' }}>{volume_name}</strong></span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Media Errors: <strong style={{ color: media_errors > 0 ? 'var(--alert-crit-border)' : 'var(--alert-green-text)' }}>{media_errors}</strong></span>
            <InfoTooltip
              title="Uncorrectable Media Errors"
              content="Number of unrecoverable data integrity faults where ECC (Error Correction Code) failed to recover stored data. Any value > 0 indicates flash cell corruption."
              width={260}
              align="right"
            />
          </div>
          {power_on_hours !== null && power_on_hours !== undefined && (
            <span>Power On: <strong style={{ color: 'var(--text-main)' }}>{power_on_hours.toLocaleString()} hrs</strong></span>
          )}
          {unsafe_shutdowns !== null && unsafe_shutdowns !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Unsafe Shutdowns: <strong style={{ color: 'var(--text-main)' }}>{unsafe_shutdowns}</strong></span>
              <InfoTooltip
                title="Unsafe Shutdown Events"
                content="Count of power interruptions or forced hard reboots where volatile DRAM cache could not be flushed cleanly to persistent NAND storage."
                width={260}
                align="right"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
