"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'

// File tree type definitions
type FileNode = {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  isOpen?: boolean;
}

// Mock file structure data
const mockFileStructure: FileNode[] = [
  {
    id: '1',
    name: 'Projects',
    type: 'folder',
    isOpen: true,
    children: [
      {
        id: '1-1',
        name: 'My Rocket',
        type: 'folder',
        isOpen: true,
        children: [
          { id: '1-1-1', name: 'Engines.json', type: 'file' },
          { id: '1-1-2', name: 'Airframe.json', type: 'file' },
          { id: '1-1-3', name: 'Payload.json', type: 'file' },
        ]
      },
      {
        id: '1-2',
        name: 'Templates',
        type: 'folder',
        children: [
          { id: '1-2-1', name: 'Basic Rocket.json', type: 'file' },
          { id: '1-2-2', name: 'Advanced Rocket.json', type: 'file' },
        ]
      }
    ]
  },
  {
    id: '2',
    name: 'Settings',
    type: 'folder',
    children: [
      { id: '2-1', name: 'User Profile.json', type: 'file' },
      { id: '2-2', name: 'Preferences.json', type: 'file' },
    ]
  }
];

// Settings categories
const settingsCategories = [
  { id: 'appearance', name: 'Appearance', icon: '🎨' },
  { id: 'performance', name: 'Performance', icon: '⚡' },
  { id: 'controls', name: 'Controls', icon: '🎮' },
  { id: 'units', name: 'Units', icon: '📏' },
  { id: 'collaboration', name: 'Collaboration', icon: '👥' },
];

type LeftPanelProps = {
  onCollapse: () => void;
  isCollapsed: boolean;
}

export default function LeftPanel({ onCollapse, isCollapsed }: LeftPanelProps) {
  const [activeTab, setActiveTab] = useState<'files' | 'settings'>('files');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedSetting, setSelectedSetting] = useState('appearance');

  // Toggle folder open/close
  const toggleFolder = (id: string, files: FileNode[]): FileNode[] => {
    return files.map(file => {
      if (file.id === id) {
        return { ...file, isOpen: !file.isOpen };
      }
      if (file.children) {
        return { ...file, children: toggleFolder(id, file.children) };
      }
      return file;
    });
  };

  // Recursive component to render file tree
  const FileTree = ({ files }: { files: FileNode[] }) => {
    return (
      <ul className="pl-3">
        {files.map(file => (
          <li key={file.id} className="my-1">
            <div 
              className={`flex items-center rounded px-2 py-1 text-small hover:bg-white hover:bg-opacity-10 cursor-pointer ${
                selectedFile === file.id ? 'bg-white bg-opacity-10 neon-border-active' : ''
              }`}
              onClick={() => {
                if (file.type === 'folder') {
                  toggleFolder(file.id, mockFileStructure);
                } else {
                  setSelectedFile(file.id);
                }
              }}
            >
              {file.type === 'folder' ? (
                <span className="mr-1 opacity-80">{file.isOpen ? '📂' : '📁'}</span>
              ) : (
                <span className="mr-1 opacity-80">📄</span>
              )}
              <span>{file.name}</span>
            </div>
            
            {file.type === 'folder' && file.isOpen && file.children && (
              <FileTree files={file.children} />
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <motion.div 
      className="h-full flex flex-col bg-black bg-opacity-30 backdrop-blur-sm"
      initial={{ width: isCollapsed ? "60px" : "320px" }}
      animate={{ width: isCollapsed ? "60px" : "320px" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {/* Panel header */}
      <div className="flex justify-between items-center p-3 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        {!isCollapsed && (
          <div className="flex space-x-3">
            <button 
              className={`px-3 py-1 rounded-full text-small transition-all ${activeTab === 'files' ? 'neon-border-active bg-white bg-opacity-10' : ''}`}
              onClick={() => setActiveTab('files')}
            >
              Files
            </button>
            <button 
              className={`px-3 py-1 rounded-full text-small transition-all ${activeTab === 'settings' ? 'neon-border-active bg-white bg-opacity-10' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          </div>
        )}
        <button 
          onClick={onCollapse}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-10 transition-colors"
          title={isCollapsed ? "Expand panel" : "Collapse panel"}
        >
          {isCollapsed ? "→" : "←"}
        </button>
      </div>

      {/* Collapsed state icons */}
      {isCollapsed ? (
        <div className="flex-1 flex flex-col items-center pt-4 space-y-6">
          <button 
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-10 transition-colors"
            title="Files"
          >
            📂
          </button>
          <button 
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-10 transition-colors"
            title="Settings"
          >
            ⚙️
          </button>
          <button 
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-10 transition-colors"
            title="New File"
          >
            ➕
          </button>
        </div>
      ) : (
        <>
          {/* Panel content - only show when expanded */}
          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === 'files' ? (
              <div>
                <div className="mb-4">
                  <h2 className="text-section-header font-medium text-white mb-2">Recent Files</h2>
                  <div className="grid grid-cols-1 gap-2">
                    {[1, 2].map(i => (
                      <div key={i} className="glass-panel p-2 rounded shadow-md">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-small font-medium text-white">Rocket Design {i}</p>
                            <p className="text-xs text-white text-opacity-70">Modified 2h ago</p>
                          </div>
                          <div className="w-8 h-8 bg-white bg-opacity-10 rounded flex items-center justify-center">
                            <span>🚀</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <h2 className="text-section-header font-medium text-white mb-2">File Explorer</h2>
                <div className="glass-panel rounded p-2 shadow-md">
                  <FileTree files={mockFileStructure} />
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-section-header font-medium text-white mb-2">Settings</h2>
                <div className="flex mb-4 overflow-x-auto pb-1">
                  {settingsCategories.map(category => (
                    <button
                      key={category.id}
                      className={`p-2 mr-2 rounded-lg flex flex-col items-center min-w-[60px] ${
                        selectedSetting === category.id ? 
                        'neon-border-active bg-white bg-opacity-10' : 
                        'glass-panel'
                      }`}
                      onClick={() => setSelectedSetting(category.id)}
                    >
                      <span className="block text-lg mb-1">{category.icon}</span>
                      <span className="block text-xs">{category.name}</span>
                    </button>
                  ))}
                </div>
                
                <div className="glass-panel rounded p-3 shadow-md">
                  <h3 className="text-body font-medium mb-3 text-white">
                    {settingsCategories.find(c => c.id === selectedSetting)?.name} Settings
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-small mb-2 text-white">Theme</label>
                      <select className="w-full glass-panel rounded-lg p-2 text-small">
                        <option>Default Dark</option>
                        <option>Blue Neon</option>
                        <option>Green Matrix</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-small mb-2 text-white">UI Density</label>
                      <div className="flex">
                        <button className="flex-1 glass-panel rounded-l-lg py-2 text-small neon-border-active bg-white bg-opacity-10">Compact</button>
                        <button className="flex-1 glass-panel rounded-r-lg py-2 text-small">Spacious</button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-small mb-2 text-white">Effect Intensity</label>
                      <input 
                        type="range" 
                        className="w-full" 
                        min="0" 
                        max="100" 
                        defaultValue="75" 
                        style={{ accentColor: 'white' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Panel footer */}
          <div className="p-3 border-t flex justify-between items-center" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div className="flex items-center">
              <div className="w-7 h-7 rounded-full bg-white bg-opacity-15 mr-2 flex items-center justify-center">
                <span className="text-xs">👤</span>
              </div>
              <span className="text-small text-white">UserName</span>
            </div>
            <button className="px-4 py-1.5 rounded-full text-small glass-panel shadow-md transition-all hover:bg-white hover:bg-opacity-10">
              {activeTab === 'files' ? 'New File' : 'Save'}
            </button>
          </div>
        </>
      )}
    </motion.div>
  )
} 