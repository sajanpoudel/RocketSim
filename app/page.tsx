"use client"

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'

// Dynamically import panels to reduce initial load time
const LeftPanel = dynamic(() => import('@/components/panels/LeftPanel'))
const MiddlePanel = dynamic(() => import('@/components/panels/MiddlePanel'))
const RightPanel = dynamic(() => import('@/components/panels/RightPanel'))

export default function RocketSim() {
  // Panel sizing state (default widths in percentages)
  const [leftPanelWidth, setLeftPanelWidth] = useState(20)
  const [rightPanelWidth, setRightPanelWidth] = useState(30)
  
  // Calculate middle panel width based on left and right panel widths
  const middlePanelWidth = 100 - leftPanelWidth - rightPanelWidth
  
  // Panel collapse state
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false)
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false)
  
  // Handle resize of panels
  const handleLeftDividerDrag = (delta: number) => {
    const newLeftWidth = Math.max(10, Math.min(30, leftPanelWidth + delta))
    setLeftPanelWidth(newLeftWidth)
  }
  
  const handleRightDividerDrag = (delta: number) => {
    const newRightWidth = Math.max(20, Math.min(40, rightPanelWidth - delta))
    setRightPanelWidth(newRightWidth)
  }
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey) {
      switch(e.key) {
        case '1':
          setIsLeftPanelCollapsed(false)
          break
        case '2':
          // Ensure middle panel is visible
          setIsLeftPanelCollapsed(false)
          setIsRightPanelCollapsed(false)
          break
        case '3':
          setIsRightPanelCollapsed(false)
          break
        default:
          break
      }
    }
  }

  return (
    <main 
      className="flex h-screen w-screen overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Left Panel - File & Settings (collapsible) */}
      <motion.div
        className="h-full glass-panel-deep"
        initial={{ width: `${leftPanelWidth}%` }}
        animate={{ 
          width: isLeftPanelCollapsed ? '0%' : `${leftPanelWidth}%`,
          opacity: isLeftPanelCollapsed ? 0 : 1
        }}
        transition={{ duration: 0.25 }}
      >
        <LeftPanel 
          onCollapse={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)} 
          isCollapsed={isLeftPanelCollapsed}
        />
      </motion.div>
      
      {/* Left Panel Divider */}
      {!isLeftPanelCollapsed && (
        <div className="panel-divider-v relative z-10 cursor-col-resize"
             onMouseDown={() => {/* Implement resize logic */}}>
          <div className="absolute inset-0 w-3 -translate-x-1/2 hover:bg-neon-primary hover:bg-opacity-20" />
        </div>
      )}
      
      {/* Middle Panel - 3D Visualization */}
      <motion.div
        className="h-full glass-panel relative"
        initial={{ width: `${middlePanelWidth}%` }}
        animate={{ 
          width: `${middlePanelWidth}%`
        }}
        transition={{ duration: 0.25 }}
      >
        <MiddlePanel />
      </motion.div>
      
      {/* Right Panel Divider */}
      {!isRightPanelCollapsed && (
        <div className="panel-divider-v relative z-10 cursor-col-resize"
             onMouseDown={() => {/* Implement resize logic */}}>
          <div className="absolute inset-0 w-3 -translate-x-1/2 hover:bg-neon-primary hover:bg-opacity-20" />
        </div>
      )}
      
      {/* Right Panel - Chat & Metrics (collapsible) */}
      <motion.div
        className="h-full glass-panel-surface flex flex-col"
        initial={{ width: `${rightPanelWidth}%` }}
        animate={{ 
          width: isRightPanelCollapsed ? '0%' : `${rightPanelWidth}%`,
          opacity: isRightPanelCollapsed ? 0 : 1
        }}
        transition={{ duration: 0.25 }}
      >
        <RightPanel 
          onCollapse={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
          isCollapsed={isRightPanelCollapsed}
        />
      </motion.div>
    </main>
  )
} 