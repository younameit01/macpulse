import React from 'react';

export default function MachineTabs({
  hosts = [],
  activeTab,
  onSelectTab,
}) {
  return (
    <div className="machine-tabs-row" role="tablist" aria-label="Machine filter tabs">
      <button
        role="tab"
        aria-selected={activeTab === 'all'}
        className={`machine-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
        onClick={() => onSelectTab('all')}
      >
        All Machines
      </button>

      {hosts.map((host) => {
        const isTabActive = activeTab === host.id;
        const displayName = host.hostname || 'Unknown Host';
        return (
          <button
            key={host.id}
            role="tab"
            aria-selected={isTabActive}
            className={`machine-tab-btn ${isTabActive ? 'active' : ''}`}
            onClick={() => onSelectTab(host.id)}
            title={displayName}
          >
            <span className="machine-tab-label">{displayName}</span>
          </button>
        );
      })}

      <button
        role="tab"
        aria-selected={activeTab === 'nfs'}
        className={`machine-tab-btn ${activeTab === 'nfs' ? 'active' : ''}`}
        onClick={() => onSelectTab('nfs')}
      >
        Shared NFS
      </button>
    </div>
  );
}
