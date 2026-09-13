import React from 'react';
import { Network, HardDrive } from 'lucide-react';
import { formatBytes } from '../api';

export default function ActiveVolumesCard({
  overview,
  onSelectVolume,
}) {
  const activeVolumes = overview?.active_volumes || [];

  // Default fallback items matching Figma if no volumes yet
  const fallbackVolumes = [
    {
      id: 'vol-1',
      mount_path: '/System/Volumes/Data',
      fs_type: 'APFS',
      hostname: 'Primary Mac',
      used_bytes: 182 * 1024 * 1024 * 1024,
      total_bytes: 245 * 1024 * 1024 * 1024,
      used_pct: 74.3,
      is_warning: false,
    },
    {
      id: 'vol-2',
      mount_path: '/Volumes/ai_cluster_datasets',
      fs_type: 'NFS',
      hostname: 'Primary Mac',
      used_bytes: 6 * 1024 * 1024 * 1024 * 1024,
      total_bytes: 10 * 1024 * 1024 * 1024 * 1024,
      used_pct: 60.0,
      is_warning: false,
    },
  ];

  const displayVolumes = (activeVolumes.length > 0 ? activeVolumes : fallbackVolumes).slice(0, 3);

  // Clean mount name for presentation
  const formatMountName = (mount) => {
    if (!mount) return 'Volume';
    if (mount === '/' || mount.includes('Data')) return 'Macintosh HD';
    if (mount.startsWith('/Volumes/')) {
      return mount.replace('/Volumes/', '');
    }
    const parts = mount.split('/');
    return parts[parts.length - 1] || mount;
  };

  return (
    <div className="card-container" style={{ minHeight: 342, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 className="card-heading">Active Volumes</h2>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.06)',
            color: 'var(--text-dim)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {displayVolumes.length} Monitored
        </span>
      </div>

      {/* Volume rows: Top 3 */}
      <div className="volume-items-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {displayVolumes.map((vol) => {
          const name = formatMountName(vol.mount_path);
          const isWarn = vol.is_warning || vol.used_pct >= 80;
          const isNfs = (vol.fs_type || '').toLowerCase() === 'nfs';
          const pct = Math.min(100, Math.max(0, vol.used_pct || 0));

          return (
            <div
              key={vol.id}
              className="volume-item-row"
              onClick={() => onSelectVolume(vol.id)}
              title={`Inspect telemetry for ${vol.mount_path}`}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Top row: Name & Pct */}
              <div className="volume-item-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isNfs ? (
                    <Network size={16} color="#c084fc" />
                  ) : (
                    <HardDrive size={16} color="var(--text-dim)" />
                  )}
                  <span className="volume-name" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                    {name}
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: isNfs ? 'rgba(192, 132, 252, 0.15)' : 'rgba(56, 189, 248, 0.12)',
                        color: isNfs ? '#c084fc' : '#38bdf8',
                        border: isNfs ? '1px solid rgba(192, 132, 252, 0.3)' : '1px solid rgba(56, 189, 248, 0.25)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {vol.fs_type || 'APFS'}
                    </span>
                  </span>
                </div>
                <span
                  className={`volume-pct ${isWarn ? 'warning' : ''}`}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: isWarn ? '#f87171' : 'var(--text-main)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {pct}%
                  {isWarn && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      Warning
                    </span>
                  )}
                </span>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  width: '100%',
                  height: 4,
                  borderRadius: 2,
                  background: 'rgba(255, 255, 255, 0.08)',
                  overflow: 'hidden',
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: isWarn
                      ? 'linear-gradient(90deg, #f97316, #ef4444)'
                      : isNfs
                        ? 'linear-gradient(90deg, #a855f7, #c084fc)'
                        : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                    borderRadius: 2,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>

              {/* Meta row */}
              <div className="volume-meta" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)' }}>
                <span>{vol.hostname || 'Mac'} {(vol.mount_path?.includes('Data') || vol.mount_path === '/') ? '· Internal SSD' : ''}</span>
                {vol.total_bytes > 0 && vol.used_bytes !== undefined ? (
                  <span>
                    {formatBytes(vol.used_bytes)} / {formatBytes(vol.total_bytes)}
                  </span>
                ) : (
                  <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{vol.mount_path}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
