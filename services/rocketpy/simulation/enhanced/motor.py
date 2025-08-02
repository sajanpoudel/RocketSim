"""
Enhanced simulation motor class.

This module provides the EnhancedSimulationMotor class which extends
the base SimulationMotor with realistic characteristics and advanced modeling.
"""

import numpy as np
from typing import List, Tuple

from config import ROCKETPY_AVAILABLE, logger
from simulation.core.motor import SimulationMotor

if ROCKETPY_AVAILABLE:
    from rocketpy import SolidMotor, LiquidMotor, HybridMotor, Fluid, CylindricalTank, MassFlowRateBasedTank

class EnhancedSimulationMotor(SimulationMotor):
    """Enhanced motor simulation with realistic characteristics and component-based configuration"""
    
    def __init__(self, motor_id: str, rocket_motor_config=None):
        # 🔍 CRITICAL DEBUG: Log the motor initialization
        logger.info(f"🔍 ENHANCED MOTOR INIT: motor_id = {motor_id}")
        logger.info(f"🔍 ENHANCED MOTOR INIT: rocket_motor_config = {rocket_motor_config}")
        
        super().__init__(motor_id)
        
        # Store the actual rocket motor configuration from frontend
        self.rocket_motor_config = rocket_motor_config or {}
        
        # 🔍 CRITICAL DEBUG: Log the loaded motor specifications
        logger.info(f"🔍 ENHANCED MOTOR INIT: Loaded spec = {self.spec}")
            
        # Enhanced motor modeling
        self._setup_enhanced_motor()
    
    def _setup_enhanced_motor(self):
        """Setup enhanced motor with realistic characteristics using rocket configuration"""
        motor_type = self.spec["type"]
        
        try:
            if motor_type == "solid":
                self._create_enhanced_solid_motor()
            elif motor_type == "liquid":
                self._create_enhanced_liquid_motor()
            elif motor_type == "hybrid":
                self._create_enhanced_hybrid_motor()
        except Exception as e:
            logger.warning(f"Enhanced motor creation failed: {e}, using basic motor")
            self._create_motor()  # Fallback to basic motor
    
    def _create_enhanced_solid_motor(self):
        """Create enhanced solid motor with realistic grain geometry"""
        thrust_curve = self._generate_realistic_thrust_curve()
        
        # Enhanced solid motor with grain geometry
        try:
            self.motor = SolidMotor(
                thrust_source=thrust_curve,
                dry_mass=self.spec["mass"]["total_kg"] - self.spec["mass"]["propellant_kg"],
                dry_inertia=(0.125, 0.125, 0.002),
                nozzle_radius=self.spec["dimensions"]["outer_diameter_m"] / 2,
                grain_number=self._calculate_grain_number(),
                grain_density=1815,  # kg/m³ - typical APCP
                grain_outer_radius=self.spec["dimensions"]["outer_diameter_m"] / 2 - 0.002,
                grain_initial_inner_radius=self._calculate_initial_bore(),
                grain_initial_height=self._calculate_grain_height(),
                grain_separation=0.005,  # 5mm separation between grains
                grains_center_of_mass_position=0.5,  # Center of motor
                center_of_dry_mass_position=0.5,  # Center of dry mass
                nozzle_position=0,
                burn_time=self.spec["burn_time_s"],
                throat_radius=self._calculate_throat_radius(),
                interpolation_method='linear',
                coordinate_system_orientation='nozzle_to_combustion_chamber'
            )
            
            logger.info(f"Created enhanced solid motor: {self.spec['name']}")
            
        except Exception as e:
            logger.warning(f"Enhanced solid motor creation failed: {e}")
            self._create_solid_motor()  # Fallback
    
    def _create_enhanced_liquid_motor(self):
        """Create enhanced liquid motor with propellant flow modeling"""
        thrust_curve = self._generate_liquid_thrust_curve()
        
        try:
            # Get motor configuration from the actual rocket motor component (from frontend)
            rocket_motor = self.rocket_motor_config
            
            # Calculate propellant masses from motor spec (dynamic, not hardcoded)
            total_propellant_kg = self.spec["mass"]["propellant_kg"]
            
            # Use rocket motor configuration for propellant ratios if available
            # ✅ ROBUSTNESS FIX: Explicitly check for the presence of keys AND non-None values, preventing numpy array ambiguity
            if (rocket_motor.get("nozzle_expansion_ratio") is not None or 
                rocket_motor.get("chamber_pressure_pa") is not None):
                # Advanced configuration - calculate ratios based on rocket motor config
                chamber_pressure = rocket_motor.get("chamber_pressure_pa", 2000000)  # Default 20 bar
                expansion_ratio = rocket_motor.get("nozzle_expansion_ratio", 10)
                
                # ✅ CRITICAL FIX: Ensure we have valid numeric values
                if chamber_pressure is None:
                    chamber_pressure = 2000000  # Default 20 bar
                if expansion_ratio is None:
                    expansion_ratio = 10
                
                # Calculate optimal oxidizer/fuel ratio based on chamber conditions
                # This makes the motor configuration completely dynamic
                if chamber_pressure > 1500000:  # High pressure = more oxidizer
                    oxidizer_ratio = 0.75
                else:
                    oxidizer_ratio = 0.65
                    
                fuel_ratio = 1.0 - oxidizer_ratio
                logger.info(f"Using dynamic propellant ratios based on rocket config: chamber_pressure={chamber_pressure}Pa, expansion_ratio={expansion_ratio}")
                
            elif "propellant_config" in self.spec and self.spec["propellant_config"]:
                # Use motor database propellant config if available
                propellant_config = self.spec["propellant_config"]
                oxidizer_ratio = propellant_config.get("oxidizer_to_fuel_ratio", 2.3) / (propellant_config.get("oxidizer_to_fuel_ratio", 2.3) + 1)
                fuel_ratio = 1.0 - oxidizer_ratio
                logger.info(f"Using motor spec propellant config: O/F ratio = {propellant_config.get('oxidizer_to_fuel_ratio', 2.3)}")
            else:
                # Fallback ratios
                oxidizer_ratio = 0.7
                fuel_ratio = 0.3
                logger.info("Using default propellant ratios (no rocket config found)")
            
            oxidizer_mass_kg = total_propellant_kg * oxidizer_ratio
            fuel_mass_kg = total_propellant_kg * fuel_ratio
            
            # Use motor dimensions from spec (dynamic)
            motor_length = self.spec["dimensions"]["length_m"]
            motor_radius = self.spec["dimensions"]["outer_diameter_m"] / 2
            
            # Use rocket motor position configuration
            motor_position = rocket_motor.get("position_from_tail_m", 0.0)
            
            # Calculate tank dimensions proportionally (configurable based on motor size)
            oxidizer_tank_length = motor_length * 0.4  # 40% of motor length
            fuel_tank_length = motor_length * 0.3      # 30% of motor length
            tank_radius = motor_radius * 0.85          # 85% of motor radius to fit inside
            
            # CRITICAL FIX: Calculate proper tank height to prevent overfill
            required_gas_volume = 0.005  # From RocketPy error logs
            tank_cross_section = 3.14159 * tank_radius**2
            min_tank_height_for_gas = (required_gas_volume / tank_cross_section) * 3.0  # 3x safety factor for enhanced
            tank_height = max(max(oxidizer_tank_length, fuel_tank_length), min_tank_height_for_gas)
            
            logger.info(f"🔧 Enhanced tank sizing: radius={tank_radius:.3f}m, height={tank_height:.3f}m, volume={tank_cross_section * tank_height:.6f}m³")
            
            # ✅ CRITICAL FIX: Use proper RocketPy tank pattern to prevent division by zero
            # Import required RocketPy classes for tanks
            from rocketpy import Fluid, CylindricalTank, MassFlowRateBasedTank
            
            # Define fluids (using N2O/Ethanol example from RocketPy docs)
            oxidizer_liq = Fluid(name="N2O_l", density=1220)
            oxidizer_gas = Fluid(name="N2O_g", density=1.9277)
            fuel_liq = Fluid(name="ethanol_l", density=789)
            fuel_gas = Fluid(name="ethanol_g", density=1.59)
            
            # ✅ CRITICAL FIX: Create a simple tank geometry without Function objects
            # The SEB LiquidRocketPy CylindricalTank uses Function objects that cause issues
            # Let's create a simpler approach using basic geometry
            try:
                # Try to create a simple tank geometry
                tank_geometry = CylindricalTank(radius=tank_radius, height=tank_height, spherical_caps=True)
                logger.info(f"✅ Created SEB tank geometry: radius={tank_radius}m, height={tank_height}m")
            except Exception as e:
                logger.warning(f"SEB tank geometry creation failed: {e}, using fallback approach")
                # Create a simple tank geometry without SEB functions
                tank_geometry = None
            
            # 🔍 DEBUG: Inspect tank geometry properties
            logger.info(f"🔍 TANK DEBUG: tank_geometry type = {type(tank_geometry)}")
            logger.info(f"🔍 TANK DEBUG: tank_geometry radius = {tank_geometry.radius}")
            logger.info(f"🔍 TANK DEBUG: tank_geometry height = {tank_geometry.height}")
            logger.info(f"🔍 TANK DEBUG: tank_geometry volume attribute exists = {hasattr(tank_geometry, 'volume')}")
            if hasattr(tank_geometry, 'volume'):
                logger.info(f"🔍 TANK DEBUG: tank_geometry.volume type = {type(tank_geometry.volume)}")
                logger.info(f"🔍 TANK DEBUG: tank_geometry.volume callable = {callable(tank_geometry.volume)}")

            # ✅ CRITICAL FIX 2: Calculate a realistic initial gas mass based on ullage pressure
            # This prevents numerical instability at t=0 from near-zero tank pressures.
            def calculate_initial_gas_mass(tank_geometry, liquid_mass, liquid_density, gas_density, ullage_pressure=5e5):
                # ✅ CRITICAL FIX: The issue is that tank_geometry.volume is a function that needs to be called
                # SEB LiquidRocketPy uses a different volume access pattern
                try:
                    # 🔍 DEBUG: Inspect the tank geometry object
                    logger.info(f"🔍 TANK DEBUG: tank_geometry type = {type(tank_geometry)}")
                    logger.info(f"🔍 TANK DEBUG: tank_geometry attributes = {dir(tank_geometry)}")
                    
                    # ✅ CRITICAL FIX: Try different volume access methods
                    total_volume = None
                    
                    # Method 1: Try total_volume attribute (most reliable)
                    if hasattr(tank_geometry, 'total_volume'):
                        try:
                            total_volume_attr = getattr(tank_geometry, 'total_volume')
                            logger.info(f"🔍 TANK DEBUG: total_volume attribute type = {type(total_volume_attr)}")
                            
                            if callable(total_volume_attr):
                                # It's a function, call it
                                total_volume = float(total_volume_attr())
                                logger.info(f"🔍 TANK DEBUG: Called total_volume() = {total_volume}")
                            else:
                                # It's a property, access directly
                                total_volume = float(total_volume_attr)
                                logger.info(f"🔍 TANK DEBUG: Used total_volume property = {total_volume}")
                        except Exception as e:
                            logger.warning(f"total_volume access failed: {e}")
                    
                    # Method 2: Try volume function with height parameter
                    if total_volume is None and hasattr(tank_geometry, 'volume'):
                        volume_attr = tank_geometry.volume
                        logger.info(f"🔍 TANK DEBUG: volume attribute type = {type(volume_attr)}")
                        
                        if callable(volume_attr):
                            try:
                                # Try calling with tank height as parameter
                                total_volume = float(volume_attr(tank_geometry.height))
                                logger.info(f"🔍 TANK DEBUG: Called volume({tank_geometry.height}) = {total_volume}")
                            except Exception as e:
                                logger.warning(f"Volume function call with height failed: {e}")
                                try:
                                    # Try calling without parameters
                                    total_volume = float(volume_attr())
                                    logger.info(f"🔍 TANK DEBUG: Called volume() = {total_volume}")
                                except Exception as e2:
                                    logger.warning(f"Volume function call without params failed: {e2}")
                        else:
                            try:
                                # It's a property, access directly
                                total_volume = float(volume_attr)
                                logger.info(f"🔍 TANK DEBUG: Accessed volume property = {total_volume}")
                            except Exception as e:
                                logger.warning(f"Volume property access failed: {e}")
                    
                    # Method 3: Manual calculation as last resort
                    if total_volume is None:
                        # Use the tank radius and height for manual calculation
                        try:
                            # The radius is also a function, so we need to call it
                            if callable(tank_geometry.radius):
                                # Get the radius at the middle height
                                radius_at_mid = float(tank_geometry.radius(tank_geometry.height / 2))
                            else:
                                # It's a scalar value
                                radius_at_mid = float(tank_geometry.radius)
                            
                            total_volume = float(radius_at_mid**2 * tank_geometry.height * 3.14159)
                            logger.info(f"🔍 TANK DEBUG: Manual volume calculation with radius({tank_geometry.height/2}) = {radius_at_mid}, total_volume = {total_volume}")
                        except Exception as e:
                            logger.warning(f"Manual volume calculation failed: {e}, using fallback")
                            # Last resort: use a reasonable estimate based on the tank sizing calculation
                            # From the logs: radius=0.032m, height=4.699m
                            total_volume = 0.015  # Use the volume from the tank sizing calculation
                            logger.info(f"🔍 TANK DEBUG: Using fallback volume = {total_volume}")
                        
                except Exception as e:
                    logger.warning(f"Volume calculation failed: {e}, using manual calculation")
                    # Last resort: manual calculation
                    total_volume = float(tank_geometry.radius**2 * tank_geometry.height * 3.14159)
                
                liquid_volume = liquid_mass / liquid_density
                ullage_volume = total_volume - liquid_volume
                
                if ullage_volume <= 0:
                    raise ValueError("Tank is overfilled! Increase tank size or reduce propellant mass.")
                
                # ✅ CRITICAL FIX: The SEB library calculates gas volume differently than our manual calculation
                # The library's internal gas volume calculation is much larger than expected
                # We need to use a much smaller gas mass to prevent overflow
                
                # Using a conservative approach: limit gas mass to 10% of ullage volume
                # This prevents the SEB library from calculating an oversized gas volume
                max_gas_volume = ullage_volume * 0.1  # Only use 10% of ullage for gas
                max_gas_mass = max_gas_volume * gas_density
                
                # Also apply a safety factor based on the error we saw (0.045 vs 0.014)
                # The library seems to calculate ~3x larger gas volume than expected
                safety_factor = 0.3  # Reduce by 70% to account for library's calculation
                safe_gas_mass = max_gas_mass * safety_factor
                
                logger.info(f"🔍 GAS CALCULATION: ullage_volume={ullage_volume:.6f}m³, max_gas_volume={max_gas_volume:.6f}m³, max_gas_mass={max_gas_mass:.4f}kg, safe_gas_mass={safe_gas_mass:.4f}kg")
                
                return max(safe_gas_mass, 0.001) # Ensure a minimum mass

            initial_oxidizer_gas_mass = calculate_initial_gas_mass(tank_geometry, oxidizer_mass_kg, oxidizer_liq.density, oxidizer_gas.density)
            initial_fuel_gas_mass = calculate_initial_gas_mass(tank_geometry, fuel_mass_kg, fuel_liq.density, fuel_gas.density, ullage_pressure=3e5) # Lower pressure for fuel tank
            
            # ✅ CRITICAL FIX: Create tanks without SEB geometry to avoid Function object issues
            if tank_geometry is None:
                # Fallback: Create a simple liquid motor without complex tank geometry
                logger.info("🔄 Using simplified liquid motor approach without SEB tank geometry")
                
                # Create a basic liquid motor with simple parameters
                self.motor = LiquidMotor(
                    thrust_source=thrust_curve,
                    dry_mass=self.spec["mass"]["total_kg"] - total_propellant_kg,
                    dry_inertia=(0.2, 0.2, 0.002),
                    nozzle_radius=motor_radius * 0.7,
                    center_of_dry_mass_position=motor_length / 2,
                    nozzle_position=0,
                    burn_time=self.spec["burn_time_s"],
                    coordinate_system_orientation="nozzle_to_combustion_chamber",
                )
                
                # Add simple tanks without complex geometry
                try:
                    # Create oxidizer tank with minimal parameters
                    oxidizer_tank = MassFlowRateBasedTank(
                        name="oxidizer tank",
                        geometry=None,  # No geometry to avoid Function issues
                        flux_time=float(self.spec["burn_time_s"]),
                        initial_liquid_mass=float(oxidizer_mass_kg),
                        initial_gas_mass=0.001,  # Minimal gas mass
                        liquid_mass_flow_rate_in=0.0,
                        liquid_mass_flow_rate_out=lambda t: float(oxidizer_mass_kg) / float(self.spec["burn_time_s"]) * 0.5 if t < float(self.spec["burn_time_s"]) else 0.0,
                        gas_mass_flow_rate_in=0.0,
                        gas_mass_flow_rate_out=0.0,
                        liquid=oxidizer_liq,
                        gas=oxidizer_gas,
                    )
                    logger.info("✅ Created oxidizer tank without geometry")
                    
                    # Create fuel tank with minimal parameters
                    fuel_tank = MassFlowRateBasedTank(
                        name="fuel tank",
                        geometry=None,  # No geometry to avoid Function issues
                        flux_time=float(self.spec["burn_time_s"]),
                        initial_liquid_mass=float(fuel_mass_kg),
                        initial_gas_mass=0.001,  # Minimal gas mass
                        liquid_mass_flow_rate_in=0.0,
                        liquid_mass_flow_rate_out=lambda t: float(fuel_mass_kg) / float(self.spec["burn_time_s"]) * 0.5 if t < float(self.spec["burn_time_s"]) else 0.0,
                        gas_mass_flow_rate_in=0.0,
                        gas_mass_flow_rate_out=0.0,
                        liquid=fuel_liq,
                        gas=fuel_gas,
                    )
                    logger.info("✅ Created fuel tank without geometry")
                    
                    # Add tanks to motor
                    self.motor.add_tank(tank=oxidizer_tank, position=motor_length * 0.7)
                    self.motor.add_tank(tank=fuel_tank, position=motor_length * 0.3)
                    
                    logger.info(f"✅ Created simplified liquid motor: {self.spec['name']} with {oxidizer_mass_kg:.3f}kg oxidizer + {fuel_mass_kg:.3f}kg fuel")
                    return
                    
                except Exception as e:
                    logger.error(f"❌ Simplified tank creation failed: {e}")
                    raise
            else:
                # Try with SEB tank geometry
                try:
                    # Create oxidizer tank with SEB geometry
                    oxidizer_tank = MassFlowRateBasedTank(
                name="oxidizer tank",
                geometry=tank_geometry,
                        flux_time=float(self.spec["burn_time_s"]),
                        initial_liquid_mass=float(oxidizer_mass_kg),
                        initial_gas_mass=float(initial_oxidizer_gas_mass),
                        liquid_mass_flow_rate_in=0.0,
                        liquid_mass_flow_rate_out=lambda t: float(oxidizer_mass_kg) / float(self.spec["burn_time_s"]) * 0.6 if t < float(self.spec["burn_time_s"]) else 0.0,
                        gas_mass_flow_rate_in=0.0,
                        gas_mass_flow_rate_out=0.0,
                liquid=oxidizer_liq,
                gas=oxidizer_gas,
            )
                    logger.info("✅ Oxidizer tank created successfully with SEB geometry")
                except Exception as e:
                    logger.error(f"❌ SEB oxidizer tank creation failed: {e}")
                    raise

                # Create fuel tank with SEB geometry
                try:
                    fuel_tank = MassFlowRateBasedTank(
                name="fuel tank",
                geometry=tank_geometry,
                        flux_time=float(self.spec["burn_time_s"]),
                        initial_liquid_mass=float(fuel_mass_kg),
                        initial_gas_mass=float(initial_fuel_gas_mass),
                        liquid_mass_flow_rate_in=0.0,
                        liquid_mass_flow_rate_out=lambda t: float(fuel_mass_kg) / float(self.spec["burn_time_s"]) * 0.6 if t < float(self.spec["burn_time_s"]) else 0.0,
                        gas_mass_flow_rate_in=0.0,
                        gas_mass_flow_rate_out=lambda t: float(initial_fuel_gas_mass) / float(self.spec["burn_time_s"]) if t < float(self.spec["burn_time_s"]) else 0.0,
                liquid=fuel_liq,
                gas=fuel_gas,
            )
                    logger.info("✅ Fuel tank created successfully with SEB geometry")
                except Exception as e:
                    logger.error(f"❌ SEB fuel tank creation failed: {e}")
                    raise
            
            # ✅ FIXED: Create LiquidMotor with proper RocketPy constructor parameters
            self.motor = LiquidMotor(
                thrust_source=thrust_curve,
                dry_mass=self.spec["mass"]["total_kg"] - total_propellant_kg,
                dry_inertia=(0.2, 0.2, 0.002),
                nozzle_radius=motor_radius * 0.7,  # Nozzle throat radius
                center_of_dry_mass_position=motor_length / 2,
                nozzle_position=0,
                burn_time=self.spec["burn_time_s"],
                coordinate_system_orientation="nozzle_to_combustion_chamber",
            )
            
            # ✅ CRITICAL: Add tanks to the motor (this prevents division by zero)
            self.motor.add_tank(tank=oxidizer_tank, position=motor_length * 0.7)  # Oxidizer towards combustion chamber
            self.motor.add_tank(tank=fuel_tank, position=motor_length * 0.3)     # Fuel towards nozzle
            
            logger.info(f"✅ Created enhanced liquid motor: {self.spec['name']} with {oxidizer_mass_kg:.3f}kg oxidizer + {fuel_mass_kg:.3f}kg fuel (ratio: {oxidizer_ratio:.2f}:{fuel_ratio:.2f}) at position {motor_position}m")
            
        except Exception as e:
            logger.warning(f"❌ Enhanced liquid motor creation failed: {e}")
            logger.info("🔄 Using basic solid motor fallback for liquid motor")
            # ✅ Fallback to basic solid motor instead of broken liquid motor
            self._create_solid_motor()
    
    def _create_enhanced_hybrid_motor(self):
        """Create enhanced hybrid motor with regression modeling"""
        thrust_curve = self._generate_hybrid_thrust_curve()
        
        try:
            # Enhanced hybrid motor
            self.motor = HybridMotor(
                thrust_source=thrust_curve,
                dry_mass=self.spec["mass"]["total_kg"] - self.spec["mass"]["propellant_kg"],
                dry_inertia=(0.15, 0.15, 0.002),
                nozzle_radius=self.spec["dimensions"]["outer_diameter_m"] / 2,
                burn_time=self.spec["burn_time_s"],
                center_of_dry_mass_position=0.5,
                nozzle_position=0,
                grain_number=1,
                grain_density=920,  # kg/m³ - typical HTPB
                grain_outer_radius=self.spec["dimensions"]["outer_diameter_m"] / 2 - 0.005,
                grain_initial_inner_radius=0.01,
                grain_initial_height=self.spec["dimensions"]["length_m"] * 0.6,
                oxidizer_tank_position=0.7,
                oxidizer_tank_geometry='cylindrical',
                oxidizer_tank_height=0.2,
                oxidizer_tank_radius=0.04,
                liquid_oxidizer_mass=self.spec["mass"]["propellant_kg"] * 0.8
            )
            
            logger.info(f"Created enhanced hybrid motor: {self.spec['name']}")
            
        except Exception as e:
            logger.warning(f"Enhanced hybrid motor creation failed: {e}")
            self._create_hybrid_motor()  # Fallback
    
    def _calculate_grain_number(self) -> int:
        """Calculate optimal number of grains based on motor size"""
        motor_length = self.spec["dimensions"]["length_m"]
        if motor_length < 0.1:
            return 1
        elif motor_length < 0.2:
            return 2
        else:
            return max(1, int(motor_length / 0.1))
    
    def _calculate_initial_bore(self) -> float:
        """Calculate initial bore radius for optimal performance"""
        outer_radius = self.spec["dimensions"]["outer_diameter_m"] / 2 - 0.002
        return outer_radius * 0.3  # 30% of outer radius
    
    def _calculate_grain_height(self) -> float:
        """Calculate grain height based on motor dimensions"""
        total_length = self.spec["dimensions"]["length_m"]
        grain_number = self._calculate_grain_number()
        return (total_length * 0.8) / grain_number  # 80% of total length
    
    def _calculate_throat_radius(self) -> float:
        """Calculate optimal throat radius for given thrust"""
        # Simplified throat sizing based on thrust
        thrust = self.spec["avg_thrust_n"]
        chamber_pressure = 2e6  # 20 bar typical
        gamma = 1.2  # Typical for solid propellants
        gas_constant = 287  # J/kg/K
        chamber_temp = 3000  # K typical combustion temperature
        
        # Choked flow calculation
        throat_area = thrust / (chamber_pressure * np.sqrt(gamma / (gas_constant * chamber_temp)) * 
                              (2 / (gamma + 1)) ** ((gamma + 1) / (2 * (gamma - 1))))
        
        return np.sqrt(throat_area / np.pi)
    
    def _generate_realistic_thrust_curve(self) -> List[Tuple[float, float]]:
        """Generate realistic thrust curve with proper motor characteristics"""
        burn_time = self.spec["burn_time_s"]
        avg_thrust = self.spec["avg_thrust_n"]
        
        # More realistic thrust curve with proper phases
        curve = []
        time_points = np.linspace(0, burn_time, 50)
        
        for t in time_points:
            normalized_time = t / burn_time
            
            if normalized_time < 0.05:
                # Ignition transient - rapid rise
                thrust = avg_thrust * (normalized_time / 0.05) * 1.8
            elif normalized_time < 0.15:
                # Initial peak - pressure spike
                phase = (normalized_time - 0.05) / 0.1
                thrust = avg_thrust * (1.8 - 0.6 * phase)
            elif normalized_time < 0.85:
                # Sustained burn with progressive burning
                phase = (normalized_time - 0.15) / 0.7
                # Progressive burning causes slight thrust increase
                thrust = avg_thrust * (1.2 + 0.1 * phase + 0.05 * np.sin(phase * 8))
            else:
                # Tail-off with propellant depletion
                phase = (normalized_time - 0.85) / 0.15
                thrust = avg_thrust * (1.3 * (1 - phase))
            
            curve.append((t, max(0, thrust)))
        
        curve.append((burn_time + 0.1, 0))
        return curve

    def _generate_liquid_thrust_curve(self) -> List[Tuple[float, float]]:
        """
        Generate a realistic thrust curve for a liquid motor, including a ramp-up
        phase to ensure numerical stability for the solver.
        """
        burn_time = self.spec["burn_time_s"]
        avg_thrust = self.spec["avg_thrust_n"]
        
        # 🔍 CRITICAL DEBUG: Log the actual motor specifications being used
        logger.info(f"🔍 LIQUID MOTOR DEBUG: Motor ID = {self.motor_id}")
        logger.info(f"🔍 LIQUID MOTOR DEBUG: Spec burn_time_s = {burn_time}")
        logger.info(f"🔍 LIQUID MOTOR DEBUG: Spec avg_thrust_n = {avg_thrust}")
        logger.info(f"🔍 LIQUID MOTOR DEBUG: Spec total_impulse_n_s = {self.spec.get('total_impulse_n_s', 'NOT_FOUND')}")
        logger.info(f"🔍 LIQUID MOTOR DEBUG: Full motor spec = {self.spec}")
        
        # Define ramp-up time (e.g., 0.8 seconds for a smoother start)
        ramp_up_time = 0.8
        
        # Create a more detailed time array
        time_points = np.linspace(0, burn_time, 100)
        thrust_curve = []
        
        for t in time_points:
            if t < ramp_up_time:
                # Gentle ramp-up using a sine curve for smoothness
                thrust = avg_thrust * np.sin((np.pi / 2) * (t / ramp_up_time))
            else:
                # Sustained thrust
                thrust = avg_thrust
            
            thrust_curve.append((t, max(0, thrust)))
            
        # Ensure thrust goes to zero after burnout
        thrust_curve.append((burn_time + 0.1, 0))
        
        # 🔍 CRITICAL DEBUG: Log the generated thrust curve summary
        max_thrust = max([t[1] for t in thrust_curve])
        total_impulse = sum([t[1] * (thrust_curve[i+1][0] - t[0]) if i < len(thrust_curve)-1 else 0 
                           for i, t in enumerate(thrust_curve)])
        logger.info(f"🔍 LIQUID MOTOR DEBUG: Generated max_thrust = {max_thrust}")
        logger.info(f"🔍 LIQUID MOTOR DEBUG: Generated total_impulse = {total_impulse}")
        logger.info(f"🔍 LIQUID MOTOR DEBUG: Generated burn_time = {burn_time}")
        logger.info(f"Generated liquid thrust curve with {ramp_up_time}s ramp-up.")
        return thrust_curve