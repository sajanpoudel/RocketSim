"use client"

import { useState, useEffect, useRef } from 'react'
import ChatPanel from '@/components/ChatPanel'
import { useRocket } from '@/lib/store'
import { estimateRocketMass, calculateStability } from '@/lib/ai/actions'
import { motion, AnimatePresence } from 'framer-motion'

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
    burnTime: 15, // s - More realistic burn time
    isp: 280, // s - More realistic ISP for liquid propellant
    type: 'liquid',
    propellantMass: 8.0, // kg - Reduced propellant mass
    dryMass: 3.0, // kg - Adjusted dry mass
    totalImpulse: 120000, // N·s - Adjusted total impulse
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
  return value.toFixed(value < 10 ? 2 : 1).replace(/\.?0+$/, '');
}

type RightPanelProps = {
  onCollapse: () => void;
  isCollapsed: boolean;
}

// Intelligent metrics summary that appears inline with chat
function InlineMetricsSummary({ metrics, isExpanded, onToggle }: {
  metrics: any;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div 
      className="mx-3 mb-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-white/10 overflow-hidden"
      layout
    >
      {/* Always visible compact header */}
      <motion.div 
        className="p-3 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={onToggle}
        layout
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-sm font-medium text-white">Flight Performance</span>
          </div>
          <div className="flex items-center space-x-4">
            {/* Key metrics always visible */}
            <div className="flex items-center space-x-3 text-xs">
              <span className="text-blue-300">{formatNumber(metrics.apogee)}m</span>
              <span className="text-green-300">{formatNumber(metrics.thrust)}N</span>
              <span className="text-purple-300">{formatNumber(metrics.thrustToWeight)}T/W</span>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Expandable detailed metrics */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {/* Performance grid */}
              <div className="grid grid-cols-3 gap-2">
                <MetricCard title="Apogee" value={metrics.apogee} unit="m" color="bg-blue-500/20" />
                <MetricCard title="Max Speed" value={metrics.velocity} unit="m/s" color="bg-green-500/20" />
                <MetricCard title="Thrust" value={metrics.thrust} unit="N" color="bg-orange-500/20" />
                <MetricCard title="Mass" value={metrics.mass} unit="kg" color="bg-purple-500/20" />
                <MetricCard title="T/W Ratio" value={metrics.thrustToWeight} unit="" color="bg-pink-500/20" />
                <MetricCard title="Stability" value={metrics.stability} unit="cal" color="bg-cyan-500/20" />
              </div>

              {/* Engine specs in compact form */}
              <div className="bg-black/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/70">Engine: {metrics.motorId}</span>
                  <span className="text-xs text-white/50">{MOTORS[metrics.motorId as keyof typeof MOTORS]?.type || 'solid'}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-white/60">Burn Time:</span>
                    <span className="text-white font-mono">{formatNumber(metrics.burnTime)}s</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white/60">Delta-V:</span>
                    <span className="text-white font-mono">{formatNumber(metrics.deltaV)}m/s</span>
                  </div>
                </div>
              </div>

              {/* Performance bars */}
              <div className="space-y-2">
                <PerformanceBar 
                  title="Altitude Performance" 
                  value={metrics.altitude} 
                  max={metrics.motorId?.includes('liquid') ? 50000 : 5000}
                  color="#3B82F6"
                />
                <PerformanceBar 
                  title="Thrust Efficiency" 
                  value={metrics.thrustToWeight} 
                  max={20}
                  color="#10B981"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Compact metric card component
function MetricCard({ title, value, unit, color }: {
  title: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <div className={`${color} rounded-lg p-2 text-center`}>
      <div className="text-xs text-white/70 mb-1">{title}</div>
      <div className="text-sm font-mono text-white">
        {formatNumber(value)}<span className="text-xs ml-1 text-white/60">{unit}</span>
      </div>
    </div>
  );
}

// Performance bar component
function PerformanceBar({ title, value, max, color }: {
  title: string;
  value: number;
  max: number;
  color: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
        <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/70">{title}</span>
        <span className="text-white">{formatNumber(value)}</span>
        </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div 
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// Enhanced chat panel wrapper with metrics integration
function IntegratedChatPanel({ metrics, metricsExpanded, onToggleMetrics }: {
  metrics: any;
  metricsExpanded: boolean;
  onToggleMetrics: () => void;
}) {
  return (
    <div className="h-full flex flex-col">
      {/* Metrics summary that sits above chat */}
      <InlineMetricsSummary 
        metrics={metrics}
        isExpanded={metricsExpanded}
        onToggle={onToggleMetrics}
      />
      
      {/* Chat panel takes remaining space */}
      <div className="flex-1 min-h-0">
        <ChatPanel />
      </div>
    </div>
  );
}

export default function RightPanel({ onCollapse, isCollapsed }: RightPanelProps) {
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  
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
  
  // Calculate estimated performance if no simulation data
  const estimatedAltitude = (deltaV * deltaV) / (2 * 9.81) * 0.7; // Rough estimate with efficiency factor
  const estimatedVelocity = deltaV * 0.8; // Rough estimate accounting for drag
  const estimatedRecoveryTime = (estimatedAltitude / 5) + 30; // Rough descent time estimate
  
  // Real metrics calculation - always use calculated values
  const metrics = {
    thrust: motorThrust,
    isp: motorIsp,
    mass: mass,
    altitude: simData?.maxAltitude || estimatedAltitude,
    velocity: simData?.maxVelocity || estimatedVelocity,
    stability: simData?.stabilityMargin || calculateStability(rocket),
    dragCoefficient: rocket.Cd,
    apogee: simData?.maxAltitude || estimatedAltitude,
    burnTime: burnTime,
    thrustToWeight: thrustToWeight,
    deltaV: deltaV,
    recoveryTime: estimatedRecoveryTime,
    motorId: rocket.motorId,
  };

  // Auto-expand metrics when simulation data changes
  useEffect(() => {
    if (simData?.maxAltitude && simData.maxAltitude > 0) {
      setMetricsExpanded(true);
      // Auto-collapse after 10 seconds to keep chat visible
      const timer = setTimeout(() => {
        setMetricsExpanded(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [simData?.maxAltitude]);

  return (
    <motion.div 
      className="h-full flex flex-col bg-black/30 backdrop-blur-sm"
      style={{ width: "100%" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {/* Streamlined header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
            <h2 className="text-sm font-medium text-white">Mission Control</h2>
          </div>
        )}
        <button 
          onClick={onCollapse}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          title={isCollapsed ? "Expand panel" : "Collapse panel"}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ duration: 0.2 }}
        >
          {isCollapsed ? "←" : "→"}
          </motion.div>
        </button>
      </div>
      
      {/* Collapsed state - minimal indicators */}
      {isCollapsed ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 py-4">
          <motion.div 
            className="flex flex-col items-center space-y-2"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center">
              <span className="text-xs">🚀</span>
            </div>
            <div className="text-xs text-white/60 writing-mode-vertical">
              {formatNumber(metrics.apogee)}m
      </div>
          </motion.div>
          
          <motion.div 
            className="flex flex-col items-center space-y-2"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-green-400 to-blue-400 flex items-center justify-center">
              <span className="text-xs">⚡</span>
            </div>
            <div className="text-xs text-white/60 writing-mode-vertical">
              {formatNumber(metrics.thrust)}N
            </div>
          </motion.div>
          
          <motion.div 
            className="flex flex-col items-center space-y-2"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, delay: 1 }}
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center">
              <span className="text-xs">💬</span>
            </div>
            <div className="text-xs text-white/60 writing-mode-vertical">
              AI
            </div>
          </motion.div>
        </div>
      ) : (
        /* Expanded state - integrated chat and metrics */
        <div className="flex-1 overflow-hidden">
          <IntegratedChatPanel 
            metrics={metrics}
            metricsExpanded={metricsExpanded}
            onToggleMetrics={() => setMetricsExpanded(!metricsExpanded)}
          />
        </div>
      )}
    </motion.div>
  )
} 