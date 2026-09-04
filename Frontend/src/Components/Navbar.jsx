import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Search, HardDrive, Settings, LogOut, Shield, Cloud } from 'lucide-react';

export default function Navbar({ searchQuery, setSearchQuery, totalStorageBytes = 0, storageQuotaGb = 50 }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Format bytes to legible storage size (MB/GB)
  const formatStorage = (bytes) => {
    if (!bytes || bytes === 0) return '0.00 MB';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const usagePercent = Math.min(Math.round(((totalStorageBytes / (1024 * 1024 * 1024)) / storageQuotaGb) * 100), 100);

  return (
    <header style={{
      backgroundColor: 'var(--bg-card)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0.875rem 1.5rem',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Brand & Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit', flexShrink: 0 }}>
          <div style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '0.625rem',
            backgroundColor: 'var(--primary-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
          }}>
            <Cloud size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.025em', color: 'var(--text-main)' }}>
              Personal Vault
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Shield size={10} color="#10b981" />
              <span>Zero-Destruction Secure Cloud</span>
            </div>
          </div>
        </Link>

        {/* Instant Search Bar */}
        <div style={{ flex: 1, maxWidth: '600px', position: 'relative' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', color: 'var(--text-light)' }} />
            <input
              type="text"
              className="input-field"
              placeholder="Instant search by filename, extension (.pdf, .xlsx), or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.75rem', borderRadius: '9999px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)' }}
            />
          </div>
        </div>

        {/* Storage Meter & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
          
          {/* Storage Gauge */}
          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'var(--bg-hover)', padding: '0.4rem 0.875rem', borderRadius: 'var(--radius-sm)' }}>
            <HardDrive size={18} color="var(--primary-blue)" />
            <div style={{ width: '130px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                <span>{formatStorage(totalStorageBytes)}</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ {storageQuotaGb} GB</span>
              </div>
              <div className="progress-container" style={{ margin: 0, height: '0.35rem' }}>
                <div className="progress-bar" style={{ width: `${usagePercent || 2}%`, background: usagePercent > 80 ? '#ef4444' : 'var(--primary-blue)' }} />
              </div>
            </div>
          </div>

          <Link to="/settings" className="btn-icon" title="Vault Settings & Preferences">
            <Settings size={20} />
          </Link>

          <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem 0.875rem', gap: '0.4rem', borderColor: '#e2e8f0' }} title="Secure Logout">
            <LogOut size={16} color="var(--text-muted)" />
            <span style={{ fontWeight: 500, fontSize: '0.8rem' }}>Logout</span>
          </button>
        </div>

      </div>
    </header>
  );
}
