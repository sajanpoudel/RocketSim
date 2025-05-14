import os
import json
import uvicorn
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Tuple, Union

# Import RocketPy
try:
    from rocketpy import Environment, SolidMotor, Rocket, Flight
except ImportError:
    print("Warning: RocketPy not installed, using simplified simulation model")
    Environment, SolidMotor, Rocket, Flight = None, None, None, None

app = FastAPI()

# Input model definitions
class Part(BaseModel):
    id: str
    type: str
    color: str 
    # Different part properties
    shape: Optional[str] = None  # For nose
    length: Optional[float] = None  # For nose, body
    baseØ: Optional[float] = None  # For nose
    Ø: Optional[float] = None  # For body
    root: Optional[float] = None  # For fin
    span: Optional[float] = None  # For fin
    sweep: Optional[float] = None  # For fin

class RocketInput(BaseModel):
    id: str
    name: str
    parts: List[Part]
    motorId: str
    Cd: float
    units: str = "metric"

class SimulationResult(BaseModel):
    maxAltitude: float  # meters
    maxVelocity: float  # m/s
    apogeeTime: float   # seconds
    stabilityMargin: float  # calibers
    thrustCurve: Optional[List[Tuple[float, float]]] = None  # time (s), thrust (N)

# Motor database
MOTORS = {
    "default-motor": {
        "name": "Generic F32",
        "manufacturer": "Generic",
        "thrust": 32,  # N
        "burnTime": 2.5,  # s
        "totalImpulse": 60,  # Ns
        "diameter": 29,  # mm
        "length": 124,  # mm
        "propellantMass": 0.04,  # kg
        "totalMass": 0.07,  # kg
    }
}

@app.post("/simulate", response_model=SimulationResult)
async def simulate(rocket_input: RocketInput) -> SimulationResult:
    try:
        # If RocketPy is available, use it for high-fidelity simulation
        if Environment is not None:
            return simulate_with_rocketpy(rocket_input)
        else:
            # Fallback to simplified physics model
            return simulate_simplified(rocket_input)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")

def simulate_with_rocketpy(rocket_input: RocketInput) -> SimulationResult:
    """High-fidelity simulation using RocketPy library"""
    
    # Create an Environment
    env = Environment(
        latitude=0,
        longitude=0,
        elevation=0,
    )
    
    # Create a motor
    motor_data = MOTORS.get(rocket_input.motorId, MOTORS["default-motor"])
    motor = SolidMotor(
        motor_data["name"],
        motor_data["thrust"],
        motor_data["burnTime"],
        motor_data["totalImpulse"],
        motor_data["propellantMass"],
        motor_data["totalMass"],
        motor_data["diameter"] / 1000,  # convert mm to m
    )
    
    # Extract rocket parameters
    nose_part = next((p for p in rocket_input.parts if p.type == "nose"), None)
    body_parts = [p for p in rocket_input.parts if p.type == "body"]
    fin_parts = [p for p in rocket_input.parts if p.type == "fin"]
    
    # Calculate rocket dimensions
    diameter = next((p.Ø for p in body_parts if p.Ø is not None), 0.05)  # m
    body_length = sum(p.length for p in body_parts if p.length is not None)  # m
    nose_length = nose_part.length if nose_part and nose_part.length else 0.15  # m
    total_length = body_length + nose_length  # m
    
    # Create the rocket
    rocket = Rocket(
        radius=diameter / 2,
        mass=1,  # Will be updated
        inertia=(0, 0, 0),  # Will be updated
        power_off_drag=rocket_input.Cd,
        power_on_drag=rocket_input.Cd,
    )
    
    # Add the motor
    rocket.add_motor(motor, position=0)
    
    # Add nose cone and other parts (simplified)
    rocket.add_nose(
        length=nose_length,
        kind=nose_part.shape if nose_part and nose_part.shape else "ogive",
    )
    
    # Add fins if present
    if fin_parts:
        fin = fin_parts[0]
        rocket.add_trapezoidal_fins(
            n=len(fin_parts),
            span=fin.span if fin.span else 0.08,
            root_chord=fin.root if fin.root else 0.1,
            sweep=fin.sweep if fin.sweep else 0.05,
        )
    
    # Configure mass
    rocket.mass = rocket.mass_empty + motor.total_mass
    
    # Simulate the flight
    flight = Flight(
        rocket=rocket,
        environment=env,
        elevation=0,
        heading=90,
    )
    
    # Extract results
    max_altitude = flight.apogee
    max_velocity = flight.max_speed
    apogee_time = flight.apogee_time
    stability_margin = rocket.static_margin
    
    # Extract thrust curve
    thrust_curve = [(t, thrust) for t, thrust in zip(flight.out.time, flight.out.thrust)]
    
    return SimulationResult(
        maxAltitude=max_altitude,
        maxVelocity=max_velocity,
        apogeeTime=apogee_time,
        stabilityMargin=stability_margin,
        thrustCurve=thrust_curve,
    )

def simulate_simplified(rocket_input: RocketInput) -> SimulationResult:
    """Simplified physics simulation as a fallback"""
    
    # Get motor data
    motor_data = MOTORS.get(rocket_input.motorId, MOTORS["default-motor"])
    
    # Extract parts data
    nose_part = next((p for p in rocket_input.parts if p.type == "nose"), None)
    body_parts = [p for p in rocket_input.parts if p.type == "body"]
    fin_parts = [p for p in rocket_input.parts if p.type == "fin"]
    
    # Simple physical parameters
    thrust = motor_data["thrust"]  # N
    burn_time = motor_data["burnTime"]  # s
    impulse = motor_data["totalImpulse"]  # Ns
    
    # Calculate mass based on parts (very simplified)
    total_mass = 0.2  # Base mass in kg
    
    # Add mass for each part
    if nose_part:
        nose_mass = 0.05 * (nose_part.length or 0.15)
        total_mass += nose_mass
    
    for body in body_parts:
        if body.length and body.Ø:
            body_mass = 0.1 * body.length * body.Ø
            total_mass += body_mass
    
    for fin in fin_parts:
        if fin.root and fin.span:
            fin_mass = 0.01 * fin.root * fin.span
            total_mass += fin_mass
    
    # Add motor mass
    total_mass += motor_data["totalMass"]
    
    # Calculate basic flight parameters
    drag_coefficient = rocket_input.Cd
    gravity = 9.8  # m/s²
    
    # Simplified physics calculations
    acceleration_max = thrust / total_mass
    average_acceleration = acceleration_max / 2
    velocity_at_burnout = average_acceleration * burn_time
    
    # Apply drag effect (simplified)
    drag_deceleration = 0.5 * drag_coefficient * velocity_at_burnout * velocity_at_burnout / total_mass
    effective_acceleration = average_acceleration - drag_deceleration - gravity
    
    # Final calculations
    max_velocity = velocity_at_burnout * 0.9  # 10% loss due to drag
    coast_time = max_velocity / gravity
    
    # Altitude calculation (s = ut + 0.5at²)
    burnout_altitude = 0.5 * average_acceleration * burn_time * burn_time
    coast_altitude = max_velocity * coast_time - 0.5 * gravity * coast_time * coast_time
    max_altitude = burnout_altitude + coast_altitude
    
    # Stability calculation based on fin area and CG position
    fin_area_ratio = 0
    for fin in fin_parts:
        if fin.root and fin.span:
            fin_area = 0.5 * fin.root * fin.span
            fin_area_ratio += fin_area / 0.01  # Normalized to a reference area
    
    stability_margin = 1.0 + 0.2 * fin_area_ratio
    
    # Generate a thrust curve
    thrust_curve = []
    # Ramp up
    for t in np.linspace(0, 0.1, 5):
        thrust_curve.append((float(t), float(thrust * t / 0.1)))
    
    # Plateau
    for t in np.linspace(0.1, burn_time - 0.2, 10):
        thrust_curve.append((float(t), float(thrust)))
    
    # Tail off
    for t in np.linspace(burn_time - 0.2, burn_time, 5):
        thrust_curve.append((float(t), float(thrust * (1 - (t - (burn_time - 0.2)) / 0.2))))
    
    # Zero thrust after burnout
    thrust_curve.append((float(burn_time), 0.0))
    thrust_curve.append((float(10.0), 0.0))  # Extend to 10 seconds
    
    return SimulationResult(
        maxAltitude=float(max_altitude),
        maxVelocity=float(max_velocity),
        apogeeTime=float(burn_time + coast_time),
        stabilityMargin=float(stability_margin),
        thrustCurve=thrust_curve,
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 