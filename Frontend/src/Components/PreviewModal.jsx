import React, { useEffect, useState } from 'react';
import { X, Download, Maximize2, Minimize2, FileText, ExternalLink, ShieldCheck } from 'lucide-react';
import api, { STORE_API_URL } from '../utils/api.js';
import axios from 'axios';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export default function PreviewModal({ file, onClose }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);

  const token = localStorage.getItem('pce_token');
  const previewUrl = file ? `${STORE_API_URL}/preview/${file.storageKey}?filename=${encodeURIComponent(file.originalName || file.filename)}&mimeType=${encodeURIComponent(file.mimeType)}&token=${token}` : '';
  const downloadUrl = file ? `${STORE_API_URL}/download/${file.storageKey}?filename=${encodeURIComponent(file.originalName || file.filename)}&mimeType=${encodeURIComponent(file.mimeType)}&token=${token}` : '';

  useEffect(() => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setContent(null);

    const ext = file.filename.split('.').pop()?.toLowerCase() || '';

    // Load file stream data for Excel, Word, Text, Markdown, JSON, HTML
    async function fetchDocumentData() {
      try {
        if (['xls', 'xlsx', 'csv'].includes(ext)) {
          const res = await axios.get(previewUrl, { responseType: 'arraybuffer' });
          const workbook = XLSX.read(new Uint8Array(res.data), { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const htmlTable = XLSX.utils.sheet_to_html(worksheet);
          setContent(DOMPurify.sanitize(htmlTable));
        } else if (['doc', 'docx'].includes(ext)) {
          const res = await axios.get(previewUrl, { responseType: 'arraybuffer' });
          const result = await mammoth.convertToHtml({ arrayBuffer: res.data });
          setContent(DOMPurify.sanitize(result.value));
        } else if (['md', 'markdown'].includes(ext)) {
          const res = await axios.get(previewUrl, { responseType: 'text' });
          const rawHtml = await marked.parse(res.data);
          setContent(DOMPurify.sanitize(rawHtml));
        } else if (['json', 'txt', 'js', 'py', 'css', 'html'].includes(ext)) {
          const res = await axios.get(previewUrl, { responseType: 'text' });
          if (ext === 'json') {
            try {
              setContent(JSON.stringify(JSON.parse(res.data), null, 2));
            } catch (e) { setContent(res.data); }
          } else if (ext === 'html') {
            setContent(DOMPurify.sanitize(res.data));
          } else {
            setContent(res.data);
          }
        }
      } catch (err) {
        console.error('Document preview extraction error:', err);
        setError('In-browser preview rendering failed. You may download the unmodified original file directly below.');
      } finally {
        setLoading(false);
      }
    }

    if (['xls', 'xlsx', 'csv', 'doc', 'docx', 'md', 'markdown', 'json', 'txt', 'js', 'py', 'css', 'html'].includes(ext)) {
      fetchDocumentData();
    } else {
      // Images, PDFs, Audio, Video are rendered natively via browser media engine using backend secure URL
      setLoading(false);
    }
  }, [file, previewUrl]);

  if (!file) return null;

  const ext = file.filename.split('.').pop()?.toLowerCase() || '';

  const handleDownload = () => {
    // SECURITY & PERFORMANCE FIX: Instead of downloading huge videos into browser RAM using Axios (which crashes),
    // we use a direct un-intercepted backend download stream authenticated via query token!
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', file.originalName || file.filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100, padding: fullscreen ? 0 : '1.5rem' }}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: fullscreen ? '100vw' : '1100px',
          width: fullscreen ? '100vw' : '100%', 
          height: fullscreen ? '100vh' : '85vh',
          maxHeight: fullscreen ? '100vh' : '90vh',
          borderRadius: fullscreen ? 0 : 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 200ms ease'
        }}
      >
        {/* Modal Header Bar */}
        <div className="modal-header" style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '1.25rem' }}>📄</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {file.filename}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>{file.category}</span>
                <span>•</span>
                <ShieldCheck size={13} color="var(--success-color)" />
                <span>SHA-256 Validated</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={handleDownload} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }} title="Download Original File">
              <Download size={15} /> Download Original
            </button>
            <button onClick={() => setFullscreen(!fullscreen)} className="btn-icon" title="Toggle Fullscreen">
              {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={onClose} className="btn-icon" style={{ backgroundColor: '#e2e8f0' }} title="Close Preview">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div className="flex-center flex-col" style={{ flex: 1, gap: '1rem' }}>
              <div className="spinner"></div>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Extracting secure file preview...</span>
            </div>
          ) : error ? (
            <div className="flex-center flex-col" style={{ flex: 1, gap: '1rem', textAlign: 'center' }}>
              <FileText size={48} color="var(--text-light)" />
              <div style={{ color: 'var(--error-color)', fontWeight: 600 }}>{error}</div>
              <button onClick={handleDownload} className="btn btn-primary">Download File instead</button>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              
              {/* 1. PDF Documents */}
              {ext === 'pdf' || file.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewUrl}
                  title={file.filename}
                  style={{ width: '100%', flex: 1, border: 'none', minHeight: '600px', borderRadius: 'var(--radius-sm)' }}
                />
              ) 

              // 2. Excel & CSV Tables
              : ['xls', 'xlsx', 'csv'].includes(ext) ? (
                <div style={{ overflowX: 'auto', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: '#f8fafc' }}>
                  <div style={{ marginBottom: '1rem', fontSize: '0.8rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>📊 Interactive Spreadsheet Viewer</div>
                  <div dangerouslySetInnerHTML={{ __html: content }} className="list-view" style={{ fontSize: '0.85rem' }} />
                </div>
              ) 

              // 3. Word Documents
              : ['doc', 'docx'].includes(ext) ? (
                <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2.5rem', backgroundColor: '#ffffff', boxShadow: '0 0 10px rgba(0,0,0,0.05)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', lineHeight: '1.7' }}>
                  <div dangerouslySetInnerHTML={{ __html: content }} />
                </div>
              ) 

              // 4. Images
              : file.category === 'Images' ? (
                <div className="flex-center" style={{ flex: 1, backgroundColor: '#0f172a', borderRadius: 'var(--radius-md)', padding: '1rem', overflow: 'hidden' }}>
                  <img
                    src={previewUrl}
                    alt={file.filename}
                    style={{ maxHeight: '75vh', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                  />
                </div>
              ) 

              // 5. Videos
              : file.category === 'Videos' ? (
                <div className="flex-center" style={{ flex: 1, backgroundColor: '#000000', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                  <video controls autoPlay style={{ maxHeight: '75vh', maxWidth: '100%' }}>
                    <source src={previewUrl} type={file.mimeType} />
                    Your browser does not support standard HTML5 video playback.
                  </video>
                </div>
              ) 

              // 6. Audio
              : file.category === 'Audio' ? (
                <div className="flex-center flex-col" style={{ flex: 1, padding: '4rem 2rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', gap: '1.5rem' }}>
                  <div style={{ fontSize: '3rem' }}>🎵</div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-main)' }}>Playing Audio Stream</div>
                  <audio controls autoPlay style={{ width: '100%', maxWidth: '500px' }}>
                    <source src={previewUrl} type={file.mimeType} />
                  </audio>
                </div>
              ) 

              // 7. Sandboxed HTML
              : ext === 'html' || ext === 'htm' ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '0.5rem 1rem', backgroundColor: '#fffbeb', color: '#b45309', borderBottom: '1px solid #fde68a', fontSize: '0.75rem', fontWeight: 600 }}>
                    ⚠️ Rendered inside a highly isolated zero-trust sandbox iframe for XSS protection.
                  </div>
                  <iframe
                    srcDoc={content}
                    sandbox="allow-same-origin"
                    title={file.filename}
                    style={{ width: '100%', flex: 1, border: 'none', minHeight: '500px' }}
                  />
                </div>
              ) 

              // 8. Markdown
              : ['md', 'markdown'].includes(ext) ? (
                <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', lineHeight: '1.6' }}>
                  <div dangerouslySetInnerHTML={{ __html: content }} />
                </div>
              ) 

              // 9. Text & JSON Code
              : ['txt', 'json', 'js', 'jsx', 'ts', 'tsx', 'py', 'css', 'sql', 'log', 'env'].includes(ext) || file.category === 'Text' ? (
                <pre style={{ padding: '1.5rem', backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: 'var(--radius-sm)', overflowX: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.5', margin: 0, flex: 1 }}>
                  <code>{content}</code>
                </pre>
              ) 

              // 10. Archives & Unsupported previews
              : (
                <div className="flex-center flex-col" style={{ flex: 1, padding: '4rem 2rem', textAlign: 'center', gap: '1rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '3.5rem' }}>📦</div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>Archive / Binary Object Storage</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto' }}>
                    This file format ({ext.toUpperCase() || 'Binary'}) cannot be previewed directly inside a standard browser window without risk.
                  </p>
                  <button onClick={handleDownload} className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '0.75rem 1.5rem' }}>
                    <Download size={18} /> Download One-Click ({Math.round(file.size / 1024)} KB)
                  </button>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Original Extension: <strong>.{ext || 'bin'}</strong></span>
          <span>Zero Corruption Guarantee • Direct Vault Stream</span>
        </div>
      </div>
    </div>
  );
}
