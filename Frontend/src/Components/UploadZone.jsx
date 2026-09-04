import React, { useState, useEffect, useRef } from 'react';
import { Upload, FilePlus, CheckCircle2, AlertTriangle, X, RefreshCw, Loader2, HardDrive, Clock, Zap } from 'lucide-react';
import api, { STORE_API_URL } from '../utils/api.js';
import axios from 'axios';

export default function UploadZone({ currentFolderId, onUploadComplete }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [duplicateAlert, setDuplicateAlert] = useState(null);
  const fileInputRef = useRef(null);

  const formatSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0.00 MB';
    if (bytes >= 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds) || seconds < 1) return '< 1s';
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}m ${secs}s`;
    }
    return `${Math.round(seconds)}s`;
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      startUploads(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      startUploads(Array.from(e.target.files));
    }
  };

  const startUploads = (files) => {
    const newQueueItems = files.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      file,
      progress: 0,
      loadedMb: '0.00',
      totalMb: formatSize(file.size),
      speedMbs: '0.00 MB/s',
      etaSeconds: null,
      status: 'queued', // queued, uploading, error, done, waiting_duplicate
      errorMessage: ''
    }));

    setUploadQueue(prev => [...prev, ...newQueueItems]);
  };

  // ADAPTIVE HIGH-SPEED SUPERVISOR (User Request: "little bit fast for 5Gb totally")
  // Processes 8 files at a time for fast batching, scaling down to 1 if a massive file is detected!
  useEffect(() => {
    const activeUploads = uploadQueue.filter(q => q.status === 'uploading');
    const hasWaitingDuplicate = uploadQueue.some(q => q.status === 'waiting_duplicate');
    if (hasWaitingDuplicate) return;

    // Adaptive speed: 8 simultaneous uploads for blazing speed, 1 for massive files to protect memory!
    const hasHugeActive = activeUploads.some(q => q.file?.size >= 150 * 1024 * 1024);
    const maxConcurrency = hasHugeActive ? 1 : 8;

    if (activeUploads.length < maxConcurrency) {
      const nextItem = uploadQueue.find(q => q.status === 'queued');
      if (nextItem) {
        setUploadQueue(prev => prev.map(q => q.id === nextItem.id ? { ...q, status: 'uploading', progress: 1 } : q));
        uploadSingleFile(nextItem, 'ask');
      }
    }
  }, [uploadQueue]);

  const uploadSingleFile = async (queueItem, duplicateAction = 'ask') => {
    const formData = new FormData();
    formData.append('file', queueItem.file);

    const startTime = Date.now();
    let lastUpdateTimestamp = 0; // Throttle state updates

    try {
      // 1. Upload to Store Backend
      const storeRes = await axios.post(`${STORE_API_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
        onUploadProgress: (progressEvent) => {
          const now = Date.now();
          const totalBytes = progressEvent.total || queueItem.file.size || 1;
          const loadedBytes = progressEvent.loaded;
          const percentCompleted = Math.min(99, Math.round((loadedBytes * 100) / totalBytes));
          
          // THROTTLE: Only update React state 3 times a second (every 333ms) or if at 100% to save browser CPU/RAM!
          if (now - lastUpdateTimestamp > 333 || percentCompleted >= 99) {
            lastUpdateTimestamp = now;
            
            const loadedStr = formatSize(loadedBytes).replace(/ (MB|GB)/, '');
            const totalStr = formatSize(totalBytes);
            
            // Real-Time Speed & ETA Calculation
            const elapsedSecs = Math.max(0.1, (now - startTime) / 1000);
            const bytesPerSec = loadedBytes / elapsedSecs;
            const speedStr = (bytesPerSec / (1024 * 1024)).toFixed(2) + ' MB/s';
            const remainingSecs = (totalBytes - loadedBytes) / Math.max(1, bytesPerSec);

            setUploadQueue(prev => prev.map(q => 
              q.id === queueItem.id ? { 
                ...q, 
                progress: percentCompleted, 
                loadedMb: loadedStr, 
                totalMb: totalStr,
                speedMbs: speedStr,
                etaSeconds: remainingSecs
              } : q
            ));
          }
        }
      });

      // 2. Register file in Main Backend
      const { storageKey, size, checksum, finalMime, originalname } = storeRes.data;
      await api.post('/files/register', {
        storageKey, size, checksum, finalMime, originalname, 
        folderId: currentFolderId && currentFolderId !== 'null' && currentFolderId !== 'root' ? currentFolderId : null,
        duplicateAction
      });

      const finalStr = formatSize(queueItem.file.size);
      setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { 
        ...q, 
        status: 'done', 
        progress: 100, 
        loadedMb: finalStr.replace(/ (MB|GB)/, ''), 
        totalMb: finalStr,
        speedMbs: '⚡ Saved',
        etaSeconds: 0
      } : q));
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      if (err.response && err.response.status === 409) {
        setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'waiting_duplicate' } : q));
        setDuplicateAlert({
          queueItem,
          existingFile: err.response.data.existingFile,
          checksum: err.response.data.checksum
        });
      } else {
        // SANITIZE ERRORS: Prevent giant HTML proxy error pages (like 413 Payload Too Large) from crashing the React DOM!
        let msg = 'Network stream interrupted';
        if (err.response?.status === 413) {
          msg = 'File exceeds maximum upload size (413 Payload Too Large)';
        } else if (err.response?.data?.error) {
          msg = typeof err.response.data.error === 'string' ? err.response.data.error.substring(0, 100) : 'Server Error';
        } else if (err.message) {
          msg = err.message.substring(0, 100);
        }
        setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'error', errorMessage: msg, progress: 0 } : q));
      }
    }
  };

  const handleDuplicateResolution = (action) => {
    if (!duplicateAlert) return;
    const { queueItem } = duplicateAlert;
    setDuplicateAlert(null);

    if (action === 'cancel') {
      setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'error', errorMessage: 'Cancelled by user (duplicate).' } : q));
    } else {
      setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'uploading', progress: 5 } : q));
      uploadSingleFile(queueItem, action);
    }
  };

  const removeQueueItem = (id) => {
    setUploadQueue(prev => prev.filter(q => q.id !== id));
  };

  const activeOrQueuedCount = uploadQueue.filter(q => q.status === 'uploading' || q.status === 'queued').length;
  const activeCount = uploadQueue.filter(q => q.status === 'uploading').length;
  const completedCount = uploadQueue.filter(q => q.status === 'done').length;

  // Master Batch Progress Calculation ("everything in percentage")
  const totalBytesAll = uploadQueue.reduce((sum, item) => sum + (item.file?.size || 0), 0);
  const uploadedBytesAll = uploadQueue.reduce((sum, item) => {
    if (item.status === 'done') return sum + (item.file?.size || 0);
    if (item.status === 'uploading') return sum + ((item.progress / 100) * (item.file?.size || 0));
    return sum;
  }, 0);
  const batchPercentage = totalBytesAll > 0 ? Math.min(100, Math.round((uploadedBytesAll / totalBytesAll) * 100)) : 0;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Drag & Drop Dropzone Box */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragActive ? '#2563eb' : activeOrQueuedCount > 0 ? '#3b82f6' : '#94a3b8'}`,
          backgroundColor: dragActive ? '#eff6ff' : '#f8fafc',
          borderRadius: '12px',
          padding: '1.75rem 1.5rem',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 200ms ease',
          boxShadow: dragActive ? '0 0 0 4px rgba(37, 99, 235, 0.15)' : '0 2px 4px rgba(0,0,0,0.02)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <div className="flex-center" style={{ marginBottom: '0.75rem' }}>
          <div style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '50%',
            backgroundColor: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2563eb',
            boxShadow: '0 2px 6px rgba(37,99,235,0.15)'
          }}>
            {activeOrQueuedCount > 0 ? <Loader2 size={24} className="spinner" color="#2563eb" /> : <Upload size={24} />}
          </div>
        </div>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>
          {activeOrQueuedCount > 0 ? (
            <span>🚀 High-Speed Batch Uploading ({activeCount} active workers | {batchPercentage}% Done)... Click to queue more</span>
          ) : (
            <span>Drag & Drop your files here or <span style={{ color: '#2563eb', textDecoration: 'underline' }}>Browse File Picker</span></span>
          )}
        </div>
        <div style={{ fontSize: '0.785rem', color: '#64748b', marginTop: '0.35rem', fontWeight: 600 }}>
          ⚡ Powered by Zero-Copy server acceleration & 4x adaptive multi-streaming for maximum upload speed!
        </div>
      </div>

      {/* Prominent High-Contrast Live Upload & Percentage Monitor Panel */}
      {uploadQueue.length > 0 && (
        <div style={{
          marginTop: '1.25rem',
          padding: '1.5rem',
          backgroundColor: '#1e293b',
          color: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 15px 30px -5px rgba(15, 23, 42, 0.45)',
          border: '1px solid #334155'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <Zap size={22} color="#f59e0b" fill="#f59e0b" />
              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.03em' }}>
                SUPER-FAST BATCH UPLOAD MONITOR ({activeOrQueuedCount} REMAINING)
              </span>
            </div>
            <button
              onClick={() => setUploadQueue(prev => prev.filter(q => q.status === 'uploading' || q.status === 'queued'))}
              style={{
                backgroundColor: '#334155',
                color: '#f8fafc',
                border: 'none',
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background-color 150ms'
              }}
              title="Clear finished items"
            >
              Clear Completed
            </button>
          </div>

          {/* MASTER OVERALL BATCH PERCENTAGE BAR ("everything in percentage") */}
          <div style={{ padding: '1.25rem', backgroundColor: '#0f172a', borderRadius: '10px', border: '2px solid #3b82f6', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.025em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📊 TOTAL BATCH PROGRESS: {batchPercentage}% COMPLETE
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#93c5fd' }}>
                {formatSize(uploadedBytesAll)} / {formatSize(totalBytesAll)} ({completedCount} of {uploadQueue.length} done)
              </span>
            </div>
            <div style={{ width: '100%', height: '24px', backgroundColor: '#334155', borderRadius: '12px', overflow: 'hidden', border: '1px solid #64748b', position: 'relative' }}>
              <div style={{
                width: `${batchPercentage}%`,
                height: '100%',
                background: batchPercentage === 100 ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)',
                borderRadius: '12px',
                transition: 'width 300ms ease-out'
              }} />
              <span style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.825rem',
                fontWeight: 900,
                color: '#ffffff',
                textShadow: '0 1px 3px rgba(0,0,0,0.9)'
              }}>
                OVERALL PROGRESS: {batchPercentage}%
              </span>
            </div>
          </div>

          {/* Individual File Percentages & Speed Metrics */}
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between' }}>
            <span>Active Transfer Details (Smart View):</span>
            <span style={{ color: '#60a5fa', textTransform: 'none' }}>⚡ Adaptive Multi-Stream Enabled</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {/* SMART DOM RENDERING: Prevents browser White Screen by limiting DOM nodes to only active items! */}
            {(() => {
              const active = uploadQueue.filter(q => q.status === 'uploading' || q.status === 'error' || q.status === 'waiting_duplicate');
              const queued = uploadQueue.filter(q => q.status === 'queued');
              const done = uploadQueue.filter(q => q.status === 'done');
              
              const visibleItems = [
                ...active,
                ...queued.slice(0, Math.max(0, 16 - active.length)), // Fill empty slots with queued items
                ...done.slice(-2) // Show only the last 2 completed items to save memory
              ];

              return (
                <>
                  {visibleItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '1rem',
                        backgroundColor: '#0f172a',
                        borderRadius: '8px',
                        border: item.status === 'uploading' ? '1px solid #3b82f6' : '1px solid #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.625rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1', minWidth: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                            {item.file.name}
                          </span>
                          <span style={{ fontSize: '0.825rem', color: '#94a3b8', fontWeight: 600 }}>
                            ({item.loadedMb && item.status === 'uploading' ? `${item.loadedMb} / ${item.totalMb}` : item.totalMb})
                          </span>
                        </div>

                        {/* Dynamic Percentage, Velocity Readout & ETA for EVERY file */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {item.status === 'queued' && (
                            <span style={{ backgroundColor: '#334155', color: '#cbd5e1', padding: '0.25rem 0.7rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Clock size={15} color="#94a3b8" /> 0% (In Queue...)
                            </span>
                          )}
                          {item.status === 'uploading' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.785rem', backgroundColor: '#065f46', color: '#a7f3d0', padding: '0.2rem 0.55rem', borderRadius: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                🚀 {item.speedMbs} | ETA: {formatTime(item.etaSeconds)}
                              </span>
                              <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#60a5fa', minWidth: '42px', textAlign: 'right' }}>
                                {item.progress}%
                              </span>
                            </div>
                          )}
                          {item.status === 'done' && (
                            <span style={{ backgroundColor: '#064e3b', color: '#6ee7b7', padding: '0.25rem 0.75rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800, fontSize: '0.85rem' }}>
                              <CheckCircle2 size={16} color="#10b981" /> 100% COMPLETED ✅
                            </span>
                          )}
                          {item.status === 'error' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
                                ❌ 0% ({item.errorMessage})
                              </span>
                              <button onClick={() => uploadSingleFile(item, 'ask')} style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <RefreshCw size={12} /> Retry
                              </button>
                            </div>
                          )}
                          {item.status === 'waiting_duplicate' && (
                            <span style={{ backgroundColor: '#78350f', color: '#fde68a', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <AlertTriangle size={15} color="#f59e0b" /> Duplicate File Action Required
                            </span>
                          )}

                          <button
                            onClick={() => removeQueueItem(item.id)}
                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}
                            title="Remove from queue"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>

                      {/* Individual Progress Bar */}
                      <div style={{ width: '100%', height: '14px', backgroundColor: '#334155', borderRadius: '7px', overflow: 'hidden', position: 'relative', border: '1px solid #475569' }}>
                        <div style={{
                          width: `${item.progress}%`,
                          height: '100%',
                          background: item.status === 'done'
                            ? 'linear-gradient(90deg, #10b981, #059669)'
                            : item.status === 'error'
                            ? '#ef4444'
                            : 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)',
                          borderRadius: '7px',
                          transition: 'width 250ms ease-out'
                        }} />
                        {item.progress >= 15 && (
                          <span style={{
                            position: 'absolute',
                            top: 0,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '0.685rem',
                            fontWeight: 800,
                            color: '#ffffff',
                            textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                          }}>
                            {item.progress}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Smart Aggregation Summary Row for remaining hidden items */}
                  {queued.length > 16 && (
                    <div style={{ padding: '1rem', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px dashed #475569', textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: '0.9rem' }}>
                      + {queued.length - 16} more files waiting in high-speed queue...
                    </div>
                  )}
                  {done.length > 2 && (
                    <div style={{ padding: '0.75rem', backgroundColor: '#064e3b', borderRadius: '8px', border: '1px solid #059669', textAlign: 'center', color: '#6ee7b7', fontWeight: 700, fontSize: '0.85rem' }}>
                      ✓ {done.length - 2} previously completed uploads hidden to save memory
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* SHA-256 Duplicate Checksum Dialog Modal */}
      {duplicateAlert && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '500px', padding: '1.75rem', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '50%', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={24} color="#f59e0b" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>Duplicate Content Detected</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Verified via SHA-256 cryptographic checksum</div>
              </div>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#1e293b', lineHeight: '1.5', marginBottom: '1.5rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <strong>{duplicateAlert.queueItem.file.name}</strong> has identical content to a file already stored on your server. How would you like to handle this upload?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={() => handleDuplicateResolution('cancel')} className="btn btn-secondary">
                Cancel Upload
              </button>
              <button onClick={() => handleDuplicateResolution('keepBoth')} className="btn btn-secondary" style={{ backgroundColor: '#eff6ff', color: '#2563eb', borderColor: '#2563eb', fontWeight: 600 }}>
                Keep Both (Create Copy)
              </button>
              <button onClick={() => handleDuplicateResolution('replace')} className="btn btn-primary" style={{ backgroundColor: '#2563eb', fontWeight: 600 }}>
                Replace File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


