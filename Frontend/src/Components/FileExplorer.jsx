import React from 'react';
import { 
  FileText, Folder as FolderIcon, Image, Table, Video, Music, Package, 
  Code, File, Eye, Download, ArrowUp, ArrowDown, Grid, List, Minimize 
} from 'lucide-react';
import api, { STORE_API_URL } from '../utils/api.js';

export default function FileExplorer({ 
  files = [], 
  folders = [], 
  loading, 
  viewMode = 'grid', 
  setViewMode, 
  sortField, 
  sortOrder, 
  onSortChange, 
  onSelectFolder,
  onOpenPreview 
}) {

  const token = localStorage.getItem('pce_token');

  // Helper to get matching file type icon
  const getFileIcon = (category, filename = '', size = 24) => {
    switch (category) {
      case 'Images': return <Image size={size} color="#d97706" />;
      case 'PDFs': return <FileText size={size} color="#dc2626" />;
      case 'Excel': return <Table size={size} color="#16a34a" />;
      case 'Word': return <FileText size={size} color="#2563eb" />;
      case 'Videos': return <Video size={size} color="#7c3aed" />;
      case 'Audio': return <Music size={size} color="#ec4899" />;
      case 'ZIP': return <Package size={size} color="#854d0e" />;
      case 'Text': return <Code size={size} color="#0284c7" />;
      default: return <File size={size} color="var(--text-muted)" />;
    }
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDownload = (file) => {
    // SECURITY & PERFORMANCE FIX: Native browser download prevents memory crashing for massive files
    const downloadUrl = `${STORE_API_URL}/download/${file.storageKey}?filename=${encodeURIComponent(file.originalName || file.filename)}&mimeType=${encodeURIComponent(file.mimeType)}&token=${token}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', file.originalName || file.filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // --------------------------------------------------------
  // PREMIUM VISUAL THUMBNAIL RENDERER
  // Automatically loads images/videos dynamically without forcing modal
  // --------------------------------------------------------
  const renderThumbnail = (file) => {
    const previewUrl = `${STORE_API_URL}/preview/${file.storageKey}?filename=${encodeURIComponent(file.originalName || file.filename)}&mimeType=${encodeURIComponent(file.mimeType)}&token=${token}`;
    const ext = file.filename.split('.').pop()?.toLowerCase() || '';
    
    if (file.category === 'Images') {
      return (
        <img 
          src={previewUrl} 
          alt={file.filename} 
          style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} 
        />
      );
    } else if (file.category === 'Videos') {
      return (
        <video 
          preload="metadata" 
          muted 
          style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', backgroundColor: '#000' }}
        >
          <source src={previewUrl} type={file.mimeType} />
        </video>
      );
    } else if (file.category === 'PDFs' || ext === 'pdf') {
      return (
        <div style={{ width: '100%', height: '140px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fca5a5' }}>
          <FileText size={42} color="#ef4444" />
          <span style={{ fontWeight: 800, marginTop: '0.75rem', letterSpacing: '0.08em', fontSize: '0.8rem', color: '#ef4444' }}>PDF DOCUMENT</span>
        </div>
      );
    } else {
      // Fallback big icon placeholder for Excel, Word, Audio, Zip
      return (
        <div style={{ width: '100%', height: '140px', backgroundColor: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {getFileIcon(file.category, file.filename, 48)}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
            {ext || 'BINARY'} FILE
          </span>
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ padding: '4rem 0' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const isEmpty = files.length === 0 && folders.length === 0;

  return (
    <div>
      {/* Explorer Ribbon & Sort Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Sort Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Sort by:</span>
          {['filename', 'uploadedAt', 'size', 'category'].map((field) => {
            const label = field === 'filename' ? 'Name' : field === 'uploadedAt' ? 'Date' : field === 'size' ? 'Size' : 'Type';
            const active = sortField === field;
            return (
              <button
                key={field}
                onClick={() => onSortChange(field)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.35rem 0.65rem',
                  border: '1px solid',
                  borderColor: active ? 'var(--primary-blue)' : 'var(--border-color)',
                  backgroundColor: active ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)',
                  color: active ? 'var(--primary-blue-hover)' : 'var(--text-main)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer'
                }}
              >
                <span>{label}</span>
                {active && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
              </button>
            );
          })}
        </div>

        {/* View Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-card)', overflow: 'hidden' }}>
          <button
            onClick={() => setViewMode('grid')}
            title="Gallery Thumbnails View"
            style={{ padding: '0.4rem 0.75rem', border: 'none', backgroundColor: viewMode === 'grid' ? 'var(--primary-blue)' : 'transparent', color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            <Grid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="List Table View"
            style={{ padding: '0.4rem 0.75rem', border: 'none', backgroundColor: viewMode === 'list' ? 'var(--primary-blue)' : 'transparent', color: viewMode === 'list' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('compact')}
            title="Compact Tiles View"
            style={{ padding: '0.4rem 0.75rem', border: 'none', backgroundColor: viewMode === 'compact' ? 'var(--primary-blue)' : 'transparent', color: viewMode === 'compact' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            <Minimize size={16} />
          </button>
        </div>

      </div>

      {isEmpty && (
        <div className="card flex-col flex-center" style={{ padding: '5rem 2rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          <FolderIcon size={48} color="rgba(255,255,255,0.2)" style={{ marginBottom: '1rem' }} />
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>No files or folders found here</div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Drag and drop documents above or create a directory folder to begin.</div>
        </div>
      )}

      {/* ========================================================
          THUMBNAIL GALLERY VIEW MODE (Requested Upgrade)
          ======================================================== */}
      {viewMode === 'grid' && !isEmpty && (
        <div className="grid-view">
          {/* Folders first */}
          {folders.map(folder => (
            <div
              key={folder._id}
              onClick={() => onSelectFolder(folder._id)}
              className="card card-hover"
              style={{ padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)' }}
            >
              <FolderIcon size={26} color="var(--primary-blue)" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {folder.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--primary-blue)' }}>Open Directory →</div>
              </div>
            </div>
          ))}

          {/* Media Thumbnail Grid Cards */}
          {files.map(file => (
            <div key={file._id} className="card card-hover flex-col" style={{ padding: '0.75rem', justifyContent: 'space-between' }}>
              
              <div onClick={() => onOpenPreview(file)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* Filename header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '0.5rem' }} title={file.filename}>
                    {file.filename}
                  </div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.4rem', backgroundColor: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', borderRadius: '4px', textTransform: 'uppercase' }}>
                    {formatSize(file.size)}
                  </span>
                </div>
                
                {/* Massive Live Thumbnail */}
                <div style={{ width: '100%', borderRadius: 'var(--radius-sm)', overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}>
                  {renderThumbnail(file)}
                </div>
              </div>

              {/* Card Action Buttons overlay */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => handleDownload(file)}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', gap: '0.35rem', borderRadius: '6px' }}
                  title="Download File"
                >
                  <Download size={14} /> Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================
          LIST TABLE VIEW MODE
          ======================================================== */}
      {viewMode === 'list' && !isEmpty && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="list-view" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Type</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {folders.map(folder => (
                <tr key={folder._id} onClick={() => onSelectFolder(folder._id)} style={{ cursor: 'pointer' }}>
                  <td style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, color: 'var(--primary-blue)' }}>
                    <FolderIcon size={20} color="var(--primary-blue)" />
                    <span>{folder.name}</span>
                  </td>
                  <td style={{ color: 'var(--text-light)' }}>—</td>
                  <td><span style={{ fontSize: '0.75rem', color: 'var(--primary-blue)', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Directory</span></td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatDate(folder.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 500 }}>Open Folder →</span>
                  </td>
                </tr>
              ))}
              {files.map(file => (
                <tr key={file._id}>
                  <td style={{ cursor: 'pointer' }} onClick={() => onOpenPreview(file)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {getFileIcon(file.category, file.filename, 20)}
                      <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{file.filename}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>{formatSize(file.size)}</td>
                  <td><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{file.category}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{formatDate(file.uploadedAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button onClick={() => handleDownload(file)} className="btn-icon" style={{ padding: '0.35rem' }} title="Download">
                        <Download size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================
          COMPACT TILES VIEW MODE
          ======================================================== */}
      {viewMode === 'compact' && !isEmpty && (
        <div className="compact-view" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
          {folders.map(folder => (
            <div key={folder._id} onClick={() => onSelectFolder(folder._id)} className="card card-hover flex-row" style={{ padding: '0.75rem', cursor: 'pointer', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
              <FolderIcon size={18} color="var(--primary-blue)" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{folder.name}</span>
            </div>
          ))}
          {files.map(file => (
            <div key={file._id} className="card card-hover flex-col" style={{ padding: '0.75rem', justifyContent: 'center', textAlign: 'center', cursor: 'pointer' }}>
              <div onClick={() => onOpenPreview(file)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                {getFileIcon(file.category, file.filename, 32)}
                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{file.filename}</span>
              </div>
              <button onClick={() => handleDownload(file)} className="btn btn-secondary" style={{ padding: '0.25rem', marginTop: '0.5rem', width: '100%', fontSize: '0.75rem' }}>
                <Download size={12} style={{ marginRight: '0.25rem' }} /> Download
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
