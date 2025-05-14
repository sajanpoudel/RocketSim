import { create } from 'zustand';
import { Rocket, Part } from '@/types/rocket';

// Default rocket configuration
export const DEFAULT_ROCKET: Rocket = {
  id: crypto.randomUUID(),
  name: 'Default Rocket',
  parts: [
    {
      id: crypto.randomUUID(),
      type: 'nose',
      color: '#A0A7B8',
      shape: 'ogive',
      length: 15,
      baseØ: 5
    },
    {
      id: crypto.randomUUID(),
      type: 'body',
      color: '#8C8D91',
      Ø: 5,
      length: 40
    },
    {
      id: crypto.randomUUID(),
      type: 'fin',
      color: '#A0A7B8',
      root: 10,
      span: 8,
      sweep: 6
    }
  ],
  motorId: 'default-motor',
  Cd: 0.35,
  units: 'metric'
};

// Simulation results interface
export interface SimulationResult {
  maxAltitude: number;
  maxVelocity: number;
  apogeeTime: number;
  stabilityMargin: number;
  thrustCurve?: [number, number][];
}

// State interface
export interface RocketState {
  rocket: Rocket;
  sim: SimulationResult | null;
  updateRocket: (fn: (rocket: Rocket) => Rocket) => void;
  setSim: (sim: SimulationResult | null) => void;
}

// Create the store
export const useRocket = create<RocketState>()((set) => ({
  rocket: DEFAULT_ROCKET,
  sim: null,
  updateRocket: (fn) => set((s) => ({ rocket: fn(structuredClone(s.rocket)) })),
  setSim: (sim) => set({ sim }),
})); 