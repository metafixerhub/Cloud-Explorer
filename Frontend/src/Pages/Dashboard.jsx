import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../Components/Navbar.jsx';
import StatsBar from '../Components/StatsBar.jsx';
import Sidebar from '../Components/Sidebar.jsx';
import Breadcrumbs from '../Components/Breadcrumbs.jsx';
import UploadZone from '../Components/UploadZone.jsx';
import FileExplorer from '../Components/FileExplorer.jsx';
import PreviewModal from '../Components/PreviewModal.jsx';
import api from '../utils/api.js';

export default function Dashboard() {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Navigation & Filtering State
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [currentCategory, setCurrentCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // View & Sorting State
  const [viewMode, setViewMode] = useState('grid');
  const [sortField, setSortField] = useState('uploadedAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Active Preview File
  const [selectedPreviewFile, setSelectedPreviewFile] = useState(null);

  // Fetch File Directory & Analytics
  const fetchRepositoryData = useCallback(async () => {
    setLoading(true);
    try {
      const folderParam = currentFolderId && currentFolderId !== 'root' ? currentFolderId : 'null';
      
      const [filesRes, statsRes] = await Promise.all([
        api.get('/files', {
          params: {
            folderId: folderParam,
            category: currentCategory === 'All' ? undefined : currentCategory,
            search: searchQuery ? searchQuery.trim() : undefined,
            sort: sortField,
            order: sortOrder,
            limit: 200
          }
        }),
        api.get('/stats')
      ]);

      setFiles(filesRes.data?.files || []);
      setFolders(filesRes.data?.folders || []);
      setStats(statsRes.data || null);
    } catch (err) {
      console.error('Failed to sync repository data from server:', err);
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, currentCategory, searchQuery, sortField, sortOrder]);

  useEffect(() => {
    fetchRepositoryData();
  }, [fetchRepositoryData]);

  // Handler for sort switching
  const handleSortChange = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Handler for navigating into a folder
  const handleSelectFolder = (folderId) => {
    setCurrentFolderId(folderId);
    setSearchQuery(''); // Reset active search when traversing folder path
  };

  return (
    <div className="full-screen" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Primary Top Header & Storage Gauge */}
      <Navbar 
        searchQuery={searchQuery} 
        setSearchQuery={(q) => { setSearchQuery(q); if(q) setCurrentCategory('All'); }} 
        totalStorageBytes={stats?.totalStorageBytes || 0} 
      />

      {/* Main Workspace Content Area */}
      <main className="container" style={{ flex: 1, width: '100%', marginTop: '0.5rem' }}>
        
        {/* At-a-Glance Repository Metric Cards */}
        <StatsBar stats={stats} />

        {/* Two-Column Workbench (Sidebar & Explorer) */}
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          
          {/* Left Navigation & Category Filter Sidebar */}
          <Sidebar 
            currentCategory={currentCategory}
            setCurrentCategory={(cat) => { setCurrentCategory(cat); setSearchQuery(''); }}
            currentFolderId={currentFolderId}
            onFolderCreated={fetchRepositoryData}
          />

          {/* Right Work Area: Breadcrumbs, Uploads & Files */}
          <div style={{ flex: 1, minWidth: '300px' }}>
            
            {/* Folder Hierarchy Trail */}
            <Breadcrumbs 
              currentFolderId={currentFolderId} 
              onSelectFolder={handleSelectFolder} 
            />

            {/* Drag & Drop Staging Area & Multi-File Progress Bar Queue */}
            <UploadZone 
              currentFolderId={currentFolderId} 
              onUploadComplete={fetchRepositoryData} 
            />

            {/* File & Directory Explorer View (Grid / List / Compact) */}
            <FileExplorer 
              files={files} 
              folders={folders} 
              loading={loading} 
              viewMode={viewMode}
              setViewMode={setViewMode}
              sortField={sortField}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              onSelectFolder={handleSelectFolder}
              onOpenPreview={(file) => setSelectedPreviewFile(file)}
            />
          </div>

        </div>
      </main>

      {/* Zero-Download In-Browser Rich Preview Viewer */}
      {selectedPreviewFile && (
        <PreviewModal 
          file={selectedPreviewFile} 
          onClose={() => setSelectedPreviewFile(null)} 
        />
      )}
    </div>
  );
}
