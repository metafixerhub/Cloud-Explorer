import React, { useState } from 'react';
import { 
  FolderPlus, Folder, Image, FileText, Table, FileCheck, 
  Video, Music, Package, Code, HelpCircle, Layers, Plus 
} from 'lucide-react';
import api from '../utils/api.js';

export default function Sidebar({ currentCategory, setCurrentCategory, currentFolderId, onFolderCreated }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const categories = [
    { id: 'All', name: 'All Vault Files', icon: Layers },
    { id: 'Images', name: 'Images', icon: Image },
    { id: 'PDFs', name: 'PDF Documents', icon: FileText },
    { id: 'Excel', name: 'Excel & Spreadsheets', icon: Table },
    { id: 'Word', name: 'Word Documents', icon: FileCheck },
    { id: 'Videos', name: 'Videos', icon: Video },
    { id: 'Audio', name: 'Audio & Voice', icon: Music },
    { id: 'ZIP', name: 'Archives & ZIP', icon: Package },
    { id: 'Text', name: 'Text & Code', icon: Code },
    { id: 'Others', name: 'Other Formats', icon: HelpCircle }
  ];

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!folderName.trim()) {
      setError('Folder name is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/folders', {
        name: folderName.trim(),
        parentFolderId: currentFolderId === 'root' ? null : currentFolderId
      });
      setFolderName('');
      setShowCreateModal(false);
      if (onFolderCreated) onFolderCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create directory folder.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside style={{ width: '250px', flexShrink: 0 }}>
      {/* Create New Folder Trigger */}
      <div style={{ marginBottom: '1.25rem' }}>
        <button
          onClick={() => { setShowCreateModal(true); setError(''); }}
          className="btn btn-secondary"
          style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', borderStyle: 'dashed', borderColor: 'var(--primary-blue)', color: 'var(--primary-blue)', fontWeight: 600 }}
        >
          <FolderPlus size={18} />
          <span>New Folder</span>
        </button>
      </div>

      {/* Category Filter Menu */}
      <div className="card" style={{ padding: '0.75rem' }}>
        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Categories & Types
        </div>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
          {categories.map((cat) => {
            const Icon = cat.icon;
            const active = currentCategory === cat.id;
            return (
              <li key={cat.id}>
                <button
                  onClick={() => setCurrentCategory(cat.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.6rem 0.75rem',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: active ? 'var(--primary-blue)' : 'transparent',
                    color: active ? '#ffffff' : 'var(--text-main)',
                    fontWeight: active ? 600 : 400,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    textAlign: 'left'
                  }}
                >
                  <Icon size={18} color={active ? '#ffffff' : 'var(--text-muted)'} />
                  <span>{cat.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <Folder size={24} color="var(--primary-blue)" />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>Create Directory Folder</h3>
            </div>
            
            {error && (
              <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--error-bg)', color: 'var(--error-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.8rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleCreateFolder}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                  FOLDER NAME
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Projects, Taxes 2026, Photos..."
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
