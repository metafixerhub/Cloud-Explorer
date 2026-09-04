import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Key, HardDrive, Shield, Sliders, CheckCircle2, AlertCircle, Trash2, AlertTriangle, CheckSquare, Square, FileText } from 'lucide-react';
import api from '../utils/api.js';

export default function Settings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [settings, setSettings] = useState(null);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // Storage Quota Manager & Selective File Deletion State
  const [files, setFiles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [storageUsedBytes, setStorageUsedBytes] = useState(0);

  async function loadFiles() {
    try {
      const res = await api.get('/files');
      if (res.data && res.data.files) {
        setFiles(res.data.files);
        const total = res.data.files.reduce((acc, f) => acc + (f.size || 0), 0);
        setStorageUsedBytes(total);
      }
    } catch (err) {
      console.error('Failed to load file list for storage manager', err);
    }
  }

  useEffect(() => {
    async function loadSettingsAndFiles() {
      try {
        const res = await api.get('/settings');
        if (res.data && res.data.settings) {
          setSettings(res.data.settings);
        }
      } catch (err) {
        console.error('Failed to load system preferences');
      }
      await loadFiles();
    }
    loadSettingsAndFiles();
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: 'New password and confirm password do not match.' });
      return;
    }
    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
      await api.post('/password', { currentPassword, newPassword });
      setStatusMsg({ type: 'success', text: 'Master password updated securely! Use your new password on next login.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.error || 'Password verification failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setLoading(true);
    try {
      await api.post('/settings', settings);
      setStatusMsg({ type: 'success', text: 'System preferences saved successfully!' });
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Failed to update system preferences.' });
    } finally {
      setLoading(false);
    }
  };

  // Checkbox Selection Handlers ("how I want how much by selecting")
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(files.map(f => f._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you certain you want to delete ${selectedIds.length} selected file(s) to free up storage space?`)) return;
    
    setLoading(true);
    try {
      const res = await api.post('/files/delete', { fileIds: selectedIds });
      setStatusMsg({ type: 'success', text: res.data.message || 'Selected files deleted successfully!' });
      setSelectedIds([]);
      await loadFiles(); // Re-calculate reclaimed storage bytes
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.error || 'Failed to delete selected files.' });
    } finally {
      setLoading(false);
    }
  };

  const maxStorageMb = settings?.uploadLimitMb || 2000;
  const maxStorageBytes = maxStorageMb * 1024 * 1024;
  const usedMb = (storageUsedBytes / (1024 * 1024)).toFixed(2);
  const usagePercent = Math.min(100, Math.round((storageUsedBytes / maxStorageBytes) * 100));
  const isHighCapacity = usagePercent >= 80;

  return (
    <div className="full-screen" style={{ backgroundColor: '#f1f5f9', padding: '2rem 1.5rem', overflowY: 'auto' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Navigation Return Button */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/" className="btn btn-secondary" style={{ textDecoration: 'none', width: 'fit-content', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={16} />
            <span>Return to Vault Dashboard</span>
          </Link>
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.5rem', letterSpacing: '-0.025em' }}>
          Vault Security, Storage & Preferences
        </h1>

        {statusMsg.text && (
          <div style={{
            padding: '1rem',
            backgroundColor: statusMsg.type === 'error' ? 'var(--error-bg)' : 'var(--success-bg)',
            color: statusMsg.type === 'error' ? 'var(--error-color)' : 'var(--success-color)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid currentColor',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}>
            {statusMsg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{statusMsg.text}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
          
          {/* 1. Master Password Modification */}
          <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
              <Key size={22} color="#3b82f6" />
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>Change Master Login Password</h2>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Encrypted immediately with 12-round bcrypt hashing</div>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: '#1e293b' }}>CURRENT PASSWORD</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Enter current password..."
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: '#1e293b' }}>NEW PASSWORD</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="New strong password..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: '#1e293b' }}>CONFIRM NEW PASSWORD</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Repeat new password..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }} disabled={loading}>
                Update Master Password
              </button>
            </form>
          </div>

          {/* 2. Storage Quota Gauge & Selective Batch File Deletion Manager */}
          <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <HardDrive size={24} color={isHighCapacity ? '#ef4444' : '#3b82f6'} />
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>Storage Capacity & Selective File Deletion</h2>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Select items individually or use "Select All" to clear space when storage reaches high capacity</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 700, color: isHighCapacity ? '#ef4444' : '#1e293b' }}>{usedMb} MB</span>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}> / {maxStorageMb} MB ({usagePercent}%)</span>
              </div>
            </div>

            {/* Progress Gauge */}
            <div style={{ width: '100%', height: '12px', backgroundColor: '#e2e8f0', borderRadius: '6px', overflow: 'hidden', marginBottom: '1.25rem' }}>
              <div style={{
                width: `${usagePercent}%`,
                height: '100%',
                backgroundColor: isHighCapacity ? '#ef4444' : '#3b82f6',
                transition: 'width 0.5s ease-in-out'
              }} />
            </div>

            {/* High Capacity Alert Banner */}
            {isHighCapacity ? (
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#fef2f2',
                borderLeft: '4px solid #ef4444',
                color: '#991b1b',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1.25rem',
                fontSize: '0.85rem',
                fontWeight: 500
              }}>
                <AlertTriangle size={18} color="#ef4444" />
                <span>Storage capacity is over 80%! Use the checkboxes below to delete obsolete files and free up server space immediately.</span>
              </div>
            ) : (
              <div style={{ fontSize: '0.825rem', color: '#64748b', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>Your vault storage capacity is healthy. When usage reaches 80% to 100%, you can select and prune items directly below.</span>
              </div>
            )}

            {/* Action Bar when Items are Selected */}
            {selectedIds.length > 0 && (
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div style={{ fontWeight: 600, color: '#9f1239', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckSquare size={18} />
                  <span>Selected {selectedIds.length} of {files.length} file(s)</span>
                </div>
                <button
                  onClick={handleBatchDelete}
                  disabled={loading}
                  style={{
                    backgroundColor: '#e11d48',
                    color: '#ffffff',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 2px 4px rgba(225, 29, 72, 0.25)'
                  }}
                >
                  <Trash2 size={16} />
                  <span>Delete Selected ({selectedIds.length})</span>
                </button>
              </div>
            )}

            {/* Interactive File Management Table */}
            {files.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#94a3b8' }}>
                No uploaded files currently stored in your vault.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '0.75rem 1rem', width: '45px' }}>
                        <input
                          type="checkbox"
                          checked={files.length > 0 && selectedIds.length === files.length}
                          onChange={handleSelectAll}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          title="Select All Files"
                        />
                      </th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>FILENAME</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>CATEGORY</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>SIZE</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569' }}>UPLOADED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f, index) => {
                      const isSelected = selectedIds.includes(f._id);
                      return (
                        <tr
                          key={f._id}
                          style={{
                            backgroundColor: isSelected ? '#fff1f2' : index % 2 === 0 ? '#ffffff' : '#f8fafc',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleSelectRow(f._id)}
                        >
                          <td style={{ padding: '0.75rem 1rem' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectRow(f._id)}
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileText size={16} color="#64748b" />
                            <span style={{ wordBreak: 'break-all' }}>{f.originalName || f.filename}</span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ padding: '0.2rem 0.6rem', backgroundColor: '#e2e8f0', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500, textTransform: 'capitalize' }}>
                              {f.category || 'general'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontWeight: 500 }}>
                            {((f.size || 0) / (1024 * 1024)).toFixed(2)} MB
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                            {new Date(f.createdAt || Date.now()).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. System Configuration & Upload Bounds */}
          {settings && (
            <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                <Sliders size={22} color="#3b82f6" />
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>System & Upload Bounds</h2>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Configure stream bandwidth and theme presentation</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: '#1e293b' }}>
                    MAXIMUM STREAM UPLOAD LIMIT (MB)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={settings.uploadLimitMb || 2000}
                    onChange={(e) => setSettings({ ...settings, uploadLimitMb: parseInt(e.target.value, 10) })}
                  />
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Default ceiling is 2000 MB (2 GB) using streaming buffer chunking to prevent memory overload.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: '#1e293b' }}>
                    ACTIVE THEME STYLESHEET
                  </label>
                  <select
                    className="input-field"
                    value={settings.defaultTheme || 'simple-white'}
                    onChange={(e) => setSettings({ ...settings, defaultTheme: e.target.value })}
                    style={{ padding: '0.625rem 1rem' }}
                  >
                    <option value="simple-white">Simple White (Crisp Modern White + Vibrant Tailored Blue Buttons)</option>
                    <option value="sleek-dark">Sleek Obsidian Dark (Coming Soon)</option>
                  </select>
                </div>

                <button onClick={handleSavePreferences} className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={loading}>
                  Save System Preferences
                </button>
              </div>
            </div>
          )}

          {/* 4. Architecture Safety & Zero-Destruction Status */}
          <div className="card" style={{ padding: '1.25rem 1.5rem', borderRadius: '12px', backgroundColor: '#f8fafc', borderLeft: '4px solid #10b981', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Shield size={22} color="#10b981" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Strict Zero-Destruction Boundary Active</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
              Your 519 personal workspace files on your computer disk remain strictly quarantined under our mandatory Zero-Destruction Policy. Deletion operations performed in the Selective Storage Manager above are cryptographically fenced to only target file blobs residing inside the internal server vault directory (<code>Backend/Uploads/</code>).
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

