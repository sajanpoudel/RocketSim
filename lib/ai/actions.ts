import { useRocket } from '../store';
import { Part, Nose, Body, Fin } from '@/types/rocket';

// Function to run a quick simulation (client-side)
export function runQuickSim() {
  // Client-side physics simulation using rocket data from store
  const { rocket, setSim } = useRocket.getState();
  
  console.log('🚀 Running quick simulation with rocket:', rocket);
  
  // Get motor data (in production, this would come from a motor database)
  // Define our complete propulsion systems database
  const propulsionSystems = {
    'mini-motor': {
      thrust: 15, // N
      burnTime: 1.8, // s
      isp: 180, // s
      type: 'solid',
      propellantMass: 0.010, // kg
      dryMass: 0.008, // kg
      totalImpulse: 27 // N·s
    },
    'default-motor': {
      thrust: 32, // N
      burnTime: 2.4, // s
      isp: 200, // s
      type: 'solid',
      propellantMass: 0.040, // kg
      dryMass: 0.015, // kg
      totalImpulse: 76.8 // N·s
    },
    'high-power': {
      thrust: 60, // N
      burnTime: 3.2, // s
      isp: 220, // s
      type: 'solid',
      propellantMass: 0.090, // kg
      dryMass: 0.025, // kg
      totalImpulse: 192 // N·s
    },
    'super-power': {
      thrust: 120, // N
      burnTime: 4.0, // s
      isp: 240, // s
      type: 'solid',
      propellantMass: 0.200, // kg
      dryMass: 0.050, // kg
      totalImpulse: 480 // N·s
    },
    'small-liquid': {
      thrust: 500, // N
      burnTime: 30, // s
      isp: 300, // s
      type: 'liquid',
      propellantMass: 1.5, // kg
      dryMass: 0.8, // kg
      totalImpulse: 15000 // N·s
    },
    'medium-liquid': {
      thrust: 2000, // N
      burnTime: 45, // s
      isp: 320, // s
      type: 'liquid',
      propellantMass: 6.5, // kg
      dryMass: 2.0, // kg
      totalImpulse: 90000 // N·s
    },
    'large-liquid': {
      thrust: 8000, // N
      burnTime: 60, // s
      isp: 340, // s
      type: 'liquid',
      propellantMass: 24.0, // kg
      dryMass: 5.0, // kg
      totalImpulse: 480000 // N·s
    },
    'hybrid-engine': {
      thrust: 1200, // N
      burnTime: 20, // s
      isp: 280, // s
      type: 'hybrid',
      propellantMass: 4.5, // kg
      dryMass: 1.2, // kg
      totalImpulse: 24000 // N·s
    }
  };
  
  // Get motor data from database or use default
  const selectedMotor = propulsionSystems[rocket.motorId as keyof typeof propulsionSystems] || propulsionSystems['default-motor'];
  const motorThrust = selectedMotor.thrust;
  const burnTime = selectedMotor.burnTime;
  const isp = selectedMotor.isp;
  
  console.log('🔧 Selected motor:', selectedMotor);
  
  // Calculate mass based on parts
  const mass = estimateRocketMass(rocket);
  
  // Add engine mass
  const totalMass = mass + selectedMotor.dryMass + selectedMotor.propellantMass;
  const dragCoefficient = rocket.Cd;
  
  console.log('📊 Mass calculations:', { mass, totalMass, dragCoefficient });
  
  // More sophisticated physics calculations
  let maxAltitude, maxVelocity;
  
  if (selectedMotor.type === 'liquid') {
    // Liquid engines need special handling
    console.log('Calculating liquid engine performance...');
    // More accurate rocket equation for liquid engines
    const exhaustVelocity = isp * 9.81; // m/s
    const deltaV = exhaustVelocity * Math.log(totalMass / (totalMass - selectedMotor.propellantMass)) 
                  - burnTime * 9.81 * 0.2; // with gravity losses
    
    // More accurate altitude estimation with air density effects
    const effectiveDeltaV = deltaV * 0.85; // 85% efficiency for drag and other losses
    maxVelocity = effectiveDeltaV;
    
    // For liquid engines, consider powered flight contribution
    const poweredAltitude = (motorThrust / totalMass - 9.81) * (burnTime**2) / 2 * 0.8;
    const ballisticAltitude = (effectiveDeltaV**2) / (2 * 9.81);
    maxAltitude = Math.max(0, poweredAltitude) + ballisticAltitude;
    
    // For very high altitudes, apply density correction
    if (maxAltitude > 10000) {
      maxAltitude *= 1.2; // Thinner air at high altitudes means less drag
    }
  } else {
    // Standard calculation for solid motors
    const acceleration = motorThrust / totalMass;
    const impulse = motorThrust * burnTime;
    const velocityFactor = selectedMotor.type === 'hybrid' ? 0.85 : 0.8;
    
    // Calculate burnout velocity using impulse (F*t = m*Δv)
    maxVelocity = impulse / totalMass * velocityFactor;
    
    // Add powered flight contribution and ballistic flight
    const poweredHeight = 0.5 * acceleration * (burnTime * burnTime) * 0.8;
    const ballisticHeight = (maxVelocity * maxVelocity) / (2 * 9.81) * 0.7;
    maxAltitude = poweredHeight + ballisticHeight;
  }
  
  // Calculate stability margin (calibers)
  const stabilityMargin = calculateStability(rocket);
  
  console.log('📈 Simulation results:', { maxAltitude, maxVelocity, stabilityMargin, motorThrust });
  
  // Set simulation results in store
  const simResults = {
    maxAltitude,
    maxVelocity,
    apogeeTime: maxVelocity / 9.8,
    stabilityMargin,
    motorThrust // Add the motor thrust to the simulation data
  };
  
  console.log('💾 Setting simulation results in store:', simResults);
  setSim(simResults);
  
  // Dispatch event to notify UI components
  window.dispatchEvent(new CustomEvent('simulationComplete', { 
    detail: simResults 
  }));
}

// Function to run a high-fidelity simulation (server-side)
export async function runHighFiSim() {
  const { rocket, setSim } = useRocket.getState();
  
  try {
    console.log('Running high-fidelity simulation...');
    
    const response = await fetch('/api/hifi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rocket }),
    });
    
    if (!response.ok) {
      throw new Error(`High-fidelity simulation failed: ${response.statusText}`);
    }
    
    const simResults = await response.json();
    console.log('Simulation results:', simResults);
    
    // Update the store with simulation results
    setSim(simResults);
  } catch (error) {
    console.error('Error running high-fidelity simulation:', error);
    // Fallback to quick sim if high-fi fails
    runQuickSim();
  }
}

// Helper function to estimate rocket mass based on parts
export function estimateRocketMass(rocket: any) {
  let totalMass = 0.05; // Base empty mass in kg
  
  // Add mass for each part
  rocket.parts.forEach((part: any) => {
    switch (part.type) {
      case 'nose':
        totalMass += 0.05 * (part.length / 10); // Mass based on nose length
        break;
      case 'body':
        totalMass += 0.1 * (part.length / 10) * part.Ø; // Mass based on body dimensions
        break;
      case 'fin':
        totalMass += 0.01 * part.root * part.span; // Mass based on fin dimensions
        break;
    }
  });
  
  // Add motor mass (approximation)
  totalMass += 0.05;
  
  return totalMass;
}

// Helper function to calculate stability margin in calibers
export function calculateStability(rocket: any) {
  // Get parts data
  const noseParts = rocket.parts.filter((p: Part) => p.type === 'nose') as Nose[];
  const bodyParts = rocket.parts.filter((p: Part) => p.type === 'body') as Body[];
  const finParts = rocket.parts.filter((p: Part) => p.type === 'fin') as Fin[];
  
  // Get diameter from the first body part (or use default)
  const diameter = bodyParts.length > 0 ? bodyParts[0].Ø : 5; // Default diameter in cm
  
  // Calculate stability (simplified)
  // More fins = more stability
  let stabilityBase = 1.0 + (finParts.length * 0.2);
  
  // Fin size effect
  let finAreaSum = 0;
  finParts.forEach((fin) => {
    if (fin.root && fin.span) {
      // Approximate fin area as 1/2 * root * span
      const finArea = 0.5 * fin.root * fin.span;
      finAreaSum += finArea;
    }
  });
  
  // Add nose cone shape effect on stability
  let noseEffect = 0;
  if (noseParts.length > 0) {
    const nose = noseParts[0];
    // Ogive nose cones provide slightly better stability than conical ones
    if (nose.shape === 'ogive') {
      noseEffect = 0.1;
    }
    // Longer nose cones affect center of pressure
    if (nose.length) {
      noseEffect += (nose.length / 50) * 0.2; // Small effect based on length
    }
  }
  
  // Adjust stability based on fin area relative to body diameter
  // More fin area relative to diameter = more stability
  const finAreaEffect = finAreaSum / (diameter * diameter) * 0.5;
  
  return stabilityBase + finAreaEffect + noseEffect;
}

// Main dispatcher function to process agent actions
export function dispatchActions(actions: any[]) {
  const { updateRocket, setSim } = useRocket.getState();
  
  console.log('🎯 Dispatching actions:', actions);
  
  actions.forEach((a) => {
    console.log('🔄 Processing action:', a);
    
    // Dispatch event for UI components to react to agent actions
    window.dispatchEvent(new CustomEvent('agentAction', { 
      detail: { action: a.action, ...a } 
    }));
    
    switch (a.action) {
      case "add_part":
        console.log('➕ Adding part:', a.type, a.props);
        updateRocket((r) => {
          r.parts.push({ id: crypto.randomUUID(), type: a.type, ...a.props });
          return r;
        });
        break;
      case "update_rocket":
        console.log('🚀 Updating rocket properties:', a.props);
        updateRocket((r) => {
          Object.assign(r, a.props);
          return r;
        });
        break;
      case "update_part":
        console.log('🔧 Updating part:', a.id, a.props);
        updateRocket((r) => {
          // First try to find by exact ID
          let p = r.parts.find((p) => p.id === a.id);
          
          // If not found by ID, try to find by type (for agent compatibility)
          if (!p) {
            // Map common agent IDs to part types
            const typeMap: { [key: string]: string } = {
              'body1': 'body',
              'nose1': 'nose', 
              'finset1': 'fin',
              'engine1': 'engine'
            };
            
            const targetType = typeMap[a.id] || a.id;
            p = r.parts.find((part) => part.type === targetType);
            
            if (p) {
              console.log(`🔄 Found part by type: ${a.id} -> ${targetType} (actual ID: ${p.id})`);
            }
          }
          
          if (p) {
            Object.assign(p, a.props);
            console.log(`✅ Updated part:`, p);
          } else {
            console.warn(`❌ Part not found: ${a.id}`);
          }
          return r;
        });
        break;
      case "run_sim":
        console.log('🚀 Running simulation with fidelity:', a.fidelity);
        // Dispatch specific event for simulation actions
        window.dispatchEvent(new CustomEvent('agentAction', { 
          detail: { action: 'run_sim', type: 'simulation', showMetrics: true } 
        }));
        
        a.fidelity === "quick"
          ? runQuickSim()          // client physics
          : runHighFiSim();        // POST /api/hifi (unchanged)
        break;
      default:
        console.log('❓ Unknown action:', a.action);
    }
  });
} 