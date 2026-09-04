import React from 'react';
import { Files, Image, FileText, Video, Table, FileCode, HardDrive } from 'lucide-react';

export default function StatsBar({ stats }) {
  if (!stats) return null;

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 MB';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const cards = [
    { label: 'Total Files', value: stats.totalFiles || 0, sub: 'Stored safely', icon: Files, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Storage Used', value: formatSize(stats.totalStorageBytes), sub: `${stats.foldersCount || 0} Folders`, icon: HardDrive, color: '#059669', bg: '#ecfdf5' },
    { label: 'Images', value: stats.categories?.Images?.count || 0, sub: formatSize(stats.categories?.Images?.size), icon: Image, color: '#d97706', bg: '#fffbeb' },
    { label: 'PDFs & Docs', value: (stats.categories?.PDFs?.count || 0) + (stats.categories?.Word?.count || 0), sub: formatSize((stats.categories?.PDFs?.size || 0) + (stats.categories?.Word?.size || 0)), icon: FileText, color: '#dc2626', bg: '#fef2f2' },
    { label: 'Excel & Data', value: (stats.categories?.Excel?.count || 0) + (stats.categories?.Text?.count || 0), sub: formatSize((stats.categories?.Excel?.size || 0) + (stats.categories?.Text?.size || 0)), icon: Table, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Videos & Audio', value: (stats.categories?.Videos?.count || 0) + (stats.categories?.Audio?.count || 0), sub: formatSize((stats.categories?.Videos?.size || 0) + (stats.categories?.Audio?.size || 0)), icon: Video, color: '#7c3aed', bg: '#f5f3ff' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '1rem',
      marginBottom: '1.5rem'
    }}>
      {cards.map((item, index) => {
        const Icon = item.icon;
        return (
          <div key={index} className="card card-hover" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: item.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Icon size={22} color={item.color} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.1rem', lineHeight: '1.2' }}>
                {item.value}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.1rem' }}>
                {item.sub}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
