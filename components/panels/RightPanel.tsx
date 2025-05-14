"use client"

import { useState, useEffect } from 'react'
import ChatPanel from '@/components/ChatPanel'
import { useRocket } from '@/lib/store'
import { estimateRocketMass, calculateStability } from '@/lib/ai/actions'

// Mock metrics data (used when no simulation has been run)
const mockMetrics = {
  thrust: 32, // N - default motor thrust
  isp: 120, // s - specific impulse
  mass: 0.5, // kg - small model rocket default
  altitude: 100, // m - placeholder
  velocity: 50, // m/s - placeholder
  stability: 1.5, // calibers - placeholder
  dragCoefficient: 0.35, // default Cd
  apogee: 100, // m - placeholder
  burnTime: 2.4, // s - default motor burn time
  recoveryTime: 120, // s - placeholder
}

// Motor database (simplified)
const MOTORS = {
  'default-motor': {
    thrust: 32, // N
    burnTime: 2.4, // s
    isp: 120 // s
  }
};

// Format numbers to prevent overflow
function formatNumber(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, '');
}

type RightPanelProps = {
  onCollapse: () => void;
  isCollapsed: boolean;
}

// Chart component for displaying metrics visually
function MetricChart({ title, value, max, unit, color = '#A0A7B8' }: {
  title: string;
  value: number;
  max: number;
  unit: string;
  color?: string;
}) {
  const percentage = (value / max) * 100;
  const formattedValue = formatNumber(value);
  
  return (
    <div className="mb-2">
      <div className="flex justify-between text-small mb-1">
        <span>{title}</span>
        <span>{formattedValue} {unit}</span>
      </div>
      <div className="h-1.5 bg-white bg-opacity-10 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full" 
          style={{ 
            width: `${percentage}%`,
            background: `linear-gradient(90deg, rgba(255,255,255,0.1) 0%, ${color} 100%)`,
          }} 
        />
      </div>
    </div>
  );
}

export default function RightPanel({ onCollapse, isCollapsed }: RightPanelProps) {
  // Get rocket and simulation data from store
  const simData = useRocket(state => state.sim);
  const rocket = useRocket(state => state.rocket);
  
  // Calculate mass using our estimation function
  const mass = estimateRocketMass(rocket);
  
  // Get motor data based on motorId
  const motorData = MOTORS[rocket.motorId as keyof typeof MOTORS] || MOTORS['default-motor'];
  const motorThrust = motorData.thrust;
  const burnTime = motorData.burnTime;
  const motorIsp = motorData.isp;
  
  // Derived metrics from sim data (or use mock if not available)
  const metrics = {
    thrust: motorThrust,
    isp: motorIsp,
    mass: mass,
    altitude: simData?.maxAltitude || mockMetrics.altitude,
    velocity: simData?.maxVelocity || mockMetrics.velocity,
    stability: simData?.stabilityMargin || calculateStability(rocket),
    dragCoefficient: rocket.Cd,
    apogee: simData?.maxAltitude || mockMetrics.apogee,
    burnTime: burnTime,
    recoveryTime: mockMetrics.recoveryTime, // TODO: add recovery time Parachute size/type (not currently defined in the rocket model)Deployment altitude Descent rate
  };

  return (
    <div className="h-full flex flex-col">
      {/* Panel header */}
      <div className="flex justify-between items-center p-3 border-b border-white border-opacity-10">
        <h2 className="text-panel-header font-light">RocketSim Assistant</h2>
        <button 
          onClick={onCollapse}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-10"
        >
          {isCollapsed ? "←" : "→"}
        </button>
      </div>
      
      {/* Chat area (60% height) */}
      <div className="flex-1 overflow-hidden flex flex-col" style={{ height: '60%' }}>
        <ChatPanel />
      </div>
      
      {/* Divider */}
      <div className="panel-divider-h"></div>
      
      {/* Metrics dashboard (40% height) */}
      <div className="p-3 overflow-y-auto" style={{ height: '40%' }}>
        <h2 className="text-panel-header font-light mb-3">Rocket Metrics</h2>
        
        {/* Key performance metrics */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
          <div className="glass-panel rounded p-2 text-center">
            <p className="text-xs text-white text-opacity-70">Thrust</p>
            <p className="text-section-header font-mono text-white">{formatNumber(metrics.thrust)} N</p>
          </div>
          <div className="glass-panel rounded p-2 text-center">
            <p className="text-xs text-white text-opacity-70">Apogee</p>
            <p className="text-section-header font-mono text-white">{formatNumber(metrics.apogee)} m</p>
          </div>
          <div className="glass-panel rounded p-2 text-center">
            <p className="text-xs text-white text-opacity-70">Mass</p>
            <p className="text-section-header font-mono text-white">{formatNumber(metrics.mass)} kg</p>
          </div>
          <div className="glass-panel rounded p-2 text-center">
            <p className="text-xs text-white text-opacity-70">Stability</p>
            <p className="text-section-header font-mono text-white">{formatNumber(metrics.stability)} cal</p>
          </div>
        </div>
        
        {/* Detailed metrics */}
        <div className="glass-panel rounded p-3 shadow-md space-y-3">
          <MetricChart title="Altitude" value={metrics.altitude} max={5000} unit="m" color="#64B5F6" />
          <MetricChart title="Velocity" value={metrics.velocity} max={500} unit="m/s" color="#81C784" />
          <MetricChart title="Thrust" value={metrics.thrust} max={3000} unit="N" color="#FFB74D" />
          <MetricChart title="Stability" value={metrics.stability} max={3} unit="cal" color="#BA68C8" />
        </div>
      </div>
    </div>
  )
} 