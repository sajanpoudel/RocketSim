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

// Enhanced motor database with more detailed properties
const MOTORS = {
  'mini-motor': {
    thrust: 15, // N
    burnTime: 1.8, // s
    isp: 180, // s
    type: 'solid',
    propellantMass: 0.010, // kg
    dryMass: 0.008, // kg
    totalImpulse: 27, // N·s
  },
  'default-motor': {
    thrust: 32, // N
    burnTime: 2.4, // s
    isp: 200, // s
    type: 'solid',
    propellantMass: 0.040, // kg
    dryMass: 0.015, // kg
    totalImpulse: 76.8, // N·s
  },
  'high-power': {
    thrust: 60, // N
    burnTime: 3.2, // s
    isp: 220, // s
    type: 'solid',
    propellantMass: 0.090, // kg
    dryMass: 0.025, // kg
    totalImpulse: 192, // N·s
  },
  'super-power': {
    thrust: 120, // N
    burnTime: 4.0, // s
    isp: 240, // s
    type: 'solid',
    propellantMass: 0.200, // kg
    dryMass: 0.050, // kg
    totalImpulse: 480, // N·s
  },
  'small-liquid': {
    thrust: 500, // N
    burnTime: 30, // s
    isp: 300, // s
    type: 'liquid',
    propellantMass: 1.5, // kg
    dryMass: 0.8, // kg
    totalImpulse: 15000, // N·s
    mixtureRatio: 2.1, // O/F ratio
  },
  'medium-liquid': {
    thrust: 2000, // N
    burnTime: 45, // s
    isp: 320, // s
    type: 'liquid',
    propellantMass: 6.5, // kg
    dryMass: 2.0, // kg
    totalImpulse: 90000, // N·s
    mixtureRatio: 2.3, // O/F ratio
  },
  'large-liquid': {
    thrust: 8000, // N
    burnTime: 60, // s
    isp: 340, // s
    type: 'liquid',
    propellantMass: 24.0, // kg
    dryMass: 5.0, // kg
    totalImpulse: 480000, // N·s
    mixtureRatio: 2.4, // O/F ratio
  },
  'hybrid-engine': {
    thrust: 1200, // N
    burnTime: 20, // s
    isp: 280, // s
    type: 'hybrid',
    propellantMass: 4.5, // kg
    dryMass: 1.2, // kg
    totalImpulse: 24000, // N·s
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

// New component for engine specifications
function EngineSpecs({ motorId }: { motorId: string }) {
  const motor = MOTORS[motorId as keyof typeof MOTORS] || MOTORS['default-motor'];
  
  return (
    <div className="glass-panel rounded p-3 mb-3">
      <h3 className="text-xs text-white text-opacity-70 mb-2">Propulsion System: {motorId}</h3>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-white text-opacity-50">Type:</span>
          <span className="ml-1 font-semibold capitalize">{motor.type}</span>
        </div>
        <div>
          <span className="text-white text-opacity-50">Thrust:</span>
          <span className="ml-1 font-semibold">{formatNumber(motor.thrust)} N</span>
        </div>
        <div>
          <span className="text-white text-opacity-50">Burn Time:</span>
          <span className="ml-1 font-semibold">{formatNumber(motor.burnTime)} s</span>
        </div>
        <div>
          <span className="text-white text-opacity-50">Spec. Impulse:</span>
          <span className="ml-1 font-semibold">{formatNumber(motor.isp)} s</span>
        </div>
        <div>
          <span className="text-white text-opacity-50">Tot. Impulse:</span>
          <span className="ml-1 font-semibold">{formatNumber(motor.totalImpulse)} N·s</span>
        </div>
        <div>
          <span className="text-white text-opacity-50">Propellant:</span>
          <span className="ml-1 font-semibold">{formatNumber(motor.propellantMass * 1000)} g</span>
        </div>
      </div>
    </div>
  );
}

// New component for physics calculation badge
function PhysicsBadge({ title, value, unit, color }: { 
  title: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <div className="glass-panel rounded p-2 text-center" style={{ borderLeft: `3px solid ${color}` }}>
      <p className="text-xs text-white text-opacity-70">{title}</p>
      <p className="text-section-header font-mono text-white">{formatNumber(value)} {unit}</p>
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
  const motorThrust = simData?.motorThrust || motorData.thrust;
  const burnTime = motorData.burnTime;
  const motorIsp = motorData.isp;
  
  // Calculate thrust-to-weight ratio
  const thrustToWeight = motorThrust / (mass * 9.81);
  
  // Calculate total delta-V using the rocket equation
  const exhaustVelocity = motorIsp * 9.81; // m/s
  const totalMass = mass + motorData.propellantMass;
  const dryMass = mass + motorData.dryMass;
  const deltaV = exhaustVelocity * Math.log(totalMass / dryMass);
  
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
    thrustToWeight: thrustToWeight,
    deltaV: deltaV,
    recoveryTime: mockMetrics.recoveryTime,
    motorId: rocket.motorId,
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
      
      {/* Chat area (50% height) */}
      <div className="flex-1 overflow-hidden flex flex-col" style={{ height: '50%' }}>
        <ChatPanel />
      </div>
      
      {/* Divider */}
      <div className="panel-divider-h"></div>
      
      {/* Metrics dashboard (50% height) */}
      <div className="p-3 overflow-y-auto" style={{ height: '50%' }}>
        <h2 className="text-panel-header font-light mb-3">Rocket Metrics</h2>
        
        {/* Engine Specifications */}
        <EngineSpecs motorId={rocket.motorId} />
        
        {/* Key performance metrics */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
          <PhysicsBadge title="Thrust" value={metrics.thrust} unit="N" color="#FFB74D" />
          <PhysicsBadge title="Apogee" value={metrics.apogee} unit="m" color="#64B5F6" />
          <PhysicsBadge title="Mass" value={metrics.mass} unit="kg" color="#81C784" />
          <PhysicsBadge title="T/W Ratio" value={metrics.thrustToWeight} unit="" color="#BA68C8" />
          <PhysicsBadge title="Delta-V" value={metrics.deltaV} unit="m/s" color="#4DB6AC" />
          <PhysicsBadge title="Stability" value={metrics.stability} unit="cal" color="#F06292" />
        </div>
        
        {/* Detailed metrics */}
        <div className="glass-panel rounded p-3 shadow-md space-y-3">
          <MetricChart title="Altitude" value={metrics.altitude} max={(metrics.motorId && metrics.motorId.includes('liquid')) ? 50000 : 5000} unit="m" color="#64B5F6" />
          <MetricChart title="Velocity" value={metrics.velocity} max={(metrics.motorId && metrics.motorId.includes('liquid')) ? 2000 : 500} unit="m/s" color="#81C784" />
          <MetricChart title="Thrust" value={metrics.thrust} max={(metrics.motorId && metrics.motorId.includes('liquid')) ? 10000 : 150} unit="N" color="#FFB74D" />
          <MetricChart title="Delta-V" value={metrics.deltaV} max={(metrics.motorId && metrics.motorId.includes('liquid')) ? 5000 : 1000} unit="m/s" color="#4DB6AC" />
          <MetricChart title="Thrust-to-Weight" value={metrics.thrustToWeight} max={50} unit="" color="#BA68C8" />
        </div>
      </div>
    </div>
  )
} 