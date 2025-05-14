import { useRocket } from '../store';
import { Part, Nose, Body, Fin } from '@/types/rocket';

// Function to run a quick simulation (client-side)
export function runQuickSim() {
  // Client-side physics simulation using rocket data from store
  const { rocket, setSim } = useRocket.getState();
  
  // Extract parts data
  const noseParts = rocket.parts.filter(p => p.type === 'nose') as Nose[];
  const bodyParts = rocket.parts.filter(p => p.type === 'body') as Body[];
  const finParts = rocket.parts.filter(p => p.type === 'fin') as Fin[];
  
  // Get motor data (in production, this would come from a motor database)
  const motorThrust = 32; // N - Example motor
  const burnTime = 2.4; // s
  
  // Calculate mass based on parts
  const mass = estimateRocketMass(rocket);
  const dragCoefficient = rocket.Cd;
  
  // Base physics calculations
  const acceleration = motorThrust / mass;
  const impulse = motorThrust * burnTime;
  const maxVelocity = impulse / mass * 0.8; // 80% efficiency due to drag
  const maxAltitude = (maxVelocity * maxVelocity) / (2 * 9.8) * 0.7; // h = v²/2g with 70% efficiency for drag
  
  // Calculate stability margin (calibers)
  const stabilityMargin = calculateStability(rocket);
  
  // Set simulation results in store
  setSim({
    maxAltitude,
    maxVelocity,
    apogeeTime: maxVelocity / 9.8,
    stabilityMargin
  });
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
  // Get diameter from the first body part (or use default)
  const bodyPart = rocket.parts.find((p: any) => p.type === 'body');
  const diameter = bodyPart ? bodyPart.Ø : 5; // Default diameter in cm
  
  // Count fins
  const finCount = rocket.parts.filter((p: any) => p.type === 'fin').length;
  
  // Calculate stability (simplified)
  // More fins = more stability
  // Larger fins = more stability
  let stabilityBase = 1.0 + (finCount * 0.2);
  
  // Fin size effect
  let finAreaSum = 0;
  rocket.parts.forEach((part: any) => {
    if (part.type === 'fin' && part.root && part.span) {
      // Approximate fin area as 1/2 * root * span
      const finArea = 0.5 * part.root * part.span;
      finAreaSum += finArea;
    }
  });
  
  // Adjust stability based on fin area relative to body diameter
  // More fin area relative to diameter = more stability
  const finAreaEffect = finAreaSum / (diameter * diameter) * 0.5;
  
  return stabilityBase + finAreaEffect;
}

// Main dispatcher function to process agent actions
export function dispatchActions(actions: any[]) {
  if (!actions || !Array.isArray(actions) || actions.length === 0) {
    console.log('No actions to dispatch');
    return;
  }
  
  console.log('Dispatching actions:', JSON.stringify(actions, null, 2));
  const { updateRocket, setSim } = useRocket.getState();
  
  actions.forEach((a) => {
    switch (a.action) {
      case "add_part":
        console.log(`Adding part of type ${a.type} with properties:`, JSON.stringify(a.props, null, 2));
        updateRocket((r) => {
          // Create a new part with the appropriate type and props
          const newPart: Partial<Part> = {
            id: crypto.randomUUID(),
            type: a.type,
            color: a.props.color || "#FFFFFF",
            ...a.props
          };
          
          // Add the new part to the rocket
          r.parts.push(newPart as Part);
          return r;
        });
        break;
        
      case "update_part":
        if (a.id === "all" && a.props.color) {
          console.log(`Updating color of ALL parts to: ${a.props.color}`);
          updateRocket((r) => {
            // Special case for updating all parts (e.g., when painting the whole rocket)
            r.parts.forEach(part => {
              part.color = a.props.color;
            });
            return r;
          });
        } else {
          console.log(`Updating part with ID ${a.id} with properties:`, JSON.stringify(a.props, null, 2));
          updateRocket((r) => {
            // Find the part to update
            const partIndex = r.parts.findIndex((p) => p.id === a.id);
            if (partIndex !== -1) {
              console.log(`Found part at index ${partIndex}, updating with new properties`);
              // Update the part with new properties
              r.parts[partIndex] = { 
                ...r.parts[partIndex], 
                ...a.props 
              };
            } else {
              console.warn(`Part with ID ${a.id} not found, update skipped`);
            }
            return r;
          });
        }
        break;
        
      case "run_sim":
        console.log(`Running ${a.fidelity} simulation`);
        if (a.fidelity === "quick") {
          runQuickSim();
        } else {
          runHighFiSim();
        }
        break;
        
      case "update_rocket":
        console.log(`Updating rocket properties:`, JSON.stringify(a.props, null, 2));
        updateRocket((r) => {
          // Update properties directly on the rocket object
          Object.assign(r, a.props);
          return r;
        });
        break;
        
      default:
        console.warn('Unknown action:', a.action);
    }
  });
  
  // Log the updated rocket state
  const updatedRocket = useRocket.getState().rocket;
  console.log('Updated rocket state:', JSON.stringify(updatedRocket, null, 2));
} 