import React, { useEffect, useState } from 'react';
import { ChevronRight, Home, FolderOpen } from 'lucide-react';
import api from '../utils/api.js';

export default function Breadcrumbs({ currentFolderId, onSelectFolder }) {
  const [trail, setTrail] = useState([{ id: 'root', name: 'Home', path: 'Home' }]);

  useEffect(() => {
    async function loadTrail() {
      try {
        const idParam = currentFolderId && currentFolderId !== 'null' ? currentFolderId : 'root';
        const res = await api.get(`/folders/${idParam}/breadcrumbs`);
        if (res.data && res.data.breadcrumbs) {
          setTrail(res.data.breadcrumbs);
        }
      } catch (err) {
        console.error('Failed to load breadcrumb path:', err);
      }
    }
    loadTrail();
  }, [currentFolderId]);

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      padding: '0.625rem 1rem',
      borderRadius: 'var(--radius-sm)',
      boxShadow: 'var(--shadow-sm)',
      marginBottom: '1rem',
      flexWrap: 'wrap'
    }}>
      {trail.map((item, index) => {
        const isLast = index === trail.length - 1;
        return (
          <React.Fragment key={item.id || index}>
            {index === 0 ? (
              <button
                onClick={() => onSelectFolder('root')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: isLast ? 'var(--text-main)' : 'var(--primary-blue)',
                  fontWeight: isLast ? 700 : 500,
                  fontSize: '0.875rem',
                  cursor: isLast ? 'default' : 'pointer'
                }}
              >
                <Home size={16} />
                <span>{item.name}</span>
              </button>
            ) : (
              <button
                onClick={() => !isLast && onSelectFolder(item.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: isLast ? 'var(--text-main)' : 'var(--primary-blue)',
                  fontWeight: isLast ? 700 : 500,
                  fontSize: '0.875rem',
                  cursor: isLast ? 'default' : 'pointer'
                }}
              >
                <FolderOpen size={15} color="var(--text-muted)" />
                <span>{item.name}</span>
              </button>
            )}

            {!isLast && (
              <ChevronRight size={16} color="var(--text-light)" style={{ margin: '0 0.1rem' }} />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
