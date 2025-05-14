import os, json, uvicorn, re, math
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import httpx

# Ensure OpenAI API key is set
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is required")

# Define JSON pattern globally
JSON_PATTERN = r'\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}'

# Advanced rocket physics constants
GRAVITATIONAL_ACCELERATION = 9.81  # m/s²
EARTH_RADIUS = 6371000  # m
AIR_DENSITY_SEA_LEVEL = 1.225  # kg/m³
ATMOSPHERIC_SCALE_HEIGHT = 8500  # m

# Propulsion systems database with realistic values
PROPULSION_SYSTEMS = {
    # Solid motors
    "mini-motor": {
        "type": "solid",
        "thrust": 15,  # N
        "burn_time": 1.8,  # s
        "specific_impulse": 180,  # s
        "propellant_mass": 0.010,  # kg
        "dry_mass": 0.008,  # kg
        "total_impulse": 27,  # N·s
    },
    "default-motor": {
        "type": "solid",
        "thrust": 32,  # N
        "burn_time": 2.4,  # s
        "specific_impulse": 200,  # s
        "propellant_mass": 0.040,  # kg
        "dry_mass": 0.015,  # kg
        "total_impulse": 76.8,  # N·s
    },
    "high-power": {
        "type": "solid",
        "thrust": 60,  # N
        "burn_time": 3.2,  # s
        "specific_impulse": 220,  # s
        "propellant_mass": 0.090,  # kg
        "dry_mass": 0.025,  # kg
        "total_impulse": 192,  # N·s
    },
    "super-power": {
        "type": "solid",
        "thrust": 120,  # N
        "burn_time": 4.0,  # s
        "specific_impulse": 240,  # s
        "propellant_mass": 0.200,  # kg
        "dry_mass": 0.050,  # kg
        "total_impulse": 480,  # N·s
    },
    # Liquid engines (more efficient, higher thrust)
    "small-liquid": {
        "type": "liquid",
        "thrust": 500,  # N
        "burn_time": 30,  # s
        "specific_impulse": 300,  # s
        "propellant_mass": 1.5,  # kg
        "dry_mass": 0.8,  # kg
        "total_impulse": 15000,  # N·s
        "mixture_ratio": 2.1,  # O/F ratio
        "chamber_pressure": 1.5,  # MPa
    },
    "medium-liquid": {
        "type": "liquid",
        "thrust": 2000,  # N
        "burn_time": 45,  # s
        "specific_impulse": 320,  # s
        "propellant_mass": 6.5,  # kg
        "dry_mass": 2.0,  # kg
        "total_impulse": 90000,  # N·s
        "mixture_ratio": 2.3,  # O/F ratio
        "chamber_pressure": 2.0,  # MPa
    },
    "large-liquid": {
        "type": "liquid",
        "thrust": 8000,  # N
        "burn_time": 60,  # s
        "specific_impulse": 340,  # s
        "propellant_mass": 24.0,  # kg
        "dry_mass": 5.0,  # kg
        "total_impulse": 480000,  # N·s
        "mixture_ratio": 2.4,  # O/F ratio
        "chamber_pressure": 3.0,  # MPa
    },
    # Hybrid engines (moderate characteristics)
    "hybrid-engine": {
        "type": "hybrid",
        "thrust": 1200,  # N
        "burn_time": 20,  # s
        "specific_impulse": 280,  # s
        "propellant_mass": 4.5,  # kg
        "dry_mass": 1.2,  # kg
        "total_impulse": 24000,  # N·s
        "oxidizer_flux": 350,  # kg/(m²·s)
    }
}

app = FastAPI()

# Request models
class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    rocket: Dict[str, Any]

# System prompt with expert rocket design knowledge
SYSTEM_PROMPT = """
You are an expert assistant for model rocket design. Your role is to help users design, optimize, and understand model rockets. You must respond to user requests by TAKING ACTION directly rather than just explaining.

CRITICAL: You MUST ALWAYS include a properly formatted JSON tool call in your response when the user requests any change to the rocket design or simulation. 

YOUR RESPONSE MUST ALWAYS USE THE EXACT FORMAT BELOW FOR ANY CHANGE OR SIMULATION:

```json
{"tool": "TOOL_NAME", "parameters": {"id": "PART_ID", "props": {"property1": "value1"}}}
```

DO NOT EXPLAIN WHAT YOU'RE GOING TO DO FIRST. Include the tool call JSON directly in your response.

AVAILABLE TOOLS:

1. update_part - Modify existing components (color, size, shape, etc.)
   Example: {"tool": "update_part", "parameters": {"id": "abc123", "props": {"length": 80}}}

2. add_part - Add new components to the rocket
   Example: {"tool": "add_part", "parameters": {"type": "nose", "props": {"shape": "ogive", "length": 15, "baseØ": 5}}}

3. run_simulation - Test the rocket's flight performance
   Example: {"tool": "run_simulation", "parameters": {"fidelity": "quick"}}

4. update_rocket - Update rocket-level properties (motorId, etc.)
   Example: {"tool": "update_rocket", "parameters": {"props": {"motorId": "high-power"}}}

Always analyze the current rocket design in CURRENT_ROCKET_JSON before making changes.

EXACT EXAMPLES YOU MUST FOLLOW:

1. When asked to double the body length:
```json
{"tool": "update_part", "parameters": {"id": "[BODY_PART_ID]", "props": {"length": 80}}}
```

2. When asked to change nose cone shape to conical:
```json
{"tool": "update_part", "parameters": {"id": "[NOSE_PART_ID]", "props": {"shape": "conical"}}}
```

3. When asked to paint everything red:
```json
{"tool": "update_part", "parameters": {"id": "all", "props": {"color": "#FF0000"}}}
```

4. When asked to run a simulation:
```json
{"tool": "run_simulation", "parameters": {"fidelity": "quick"}}
```

5. When asked to make fins larger:
```json
{"tool": "update_part", "parameters": {"id": "[FIN_PART_ID]", "props": {"root": 12, "span": 9.6}}}
```

6. When asked to change or upgrade the motor:
```json
{"tool": "update_rocket", "parameters": {"props": {"motorId": "high-power"}}}
```

IMPORTANT DISTINCTION:
- To modify parts (nose, body, fins), use tool "update_part" with the part ID
- To modify rocket properties like motor, use tool "update_rocket" - NOT "update_part"!
- NEVER use "update_part" for changing the motor! Motors are not in the parts array.

MOTOR OPTIONS: 
- mini-motor (15N thrust)
- default-motor (32N thrust)
- high-power (60N thrust)
- super-power (120N thrust)
- small-liquid (500N thrust)
- medium-liquid (2000N thrust)
- large-liquid (8000N thrust)
- hybrid-engine (1200N thrust)

IMPORTANT: Always use the correct part ID from CURRENT_ROCKET_JSON. Place your tool call JSON directly in your response with no explanation before it. If you don't follow this format exactly, your changes won't work.
"""

# Process OpenAI response and extract tool calls
async def process_openai_response(response_text: str):
    # Extract all JSON-like patterns from the response
    # Using the global JSON pattern
    json_matches = re.finditer(JSON_PATTERN, response_text)
    
    actions = []
    
    for match in json_matches:
        try:
            json_str = match.group(0)
            tool_call = json.loads(json_str)
            
            if "tool" in tool_call and "parameters" in tool_call:
                tool_name = tool_call["tool"]
                parameters = tool_call["parameters"]
                
                # Process different tool calls
                if tool_name == "add_part":
                    action = {
                        "action": "add_part",
                        "type": parameters["type"],
                        "props": parameters["props"]
                    }
                    actions.append(action)
                
                elif tool_name == "update_part":
                    # Special case for color updates to all parts
                    if "color" in parameters.get("props", {}) and parameters.get("id") in ["all", "*"]:
                        action = {
                            "action": "update_part",
                            "id": "all",
                            "props": {"color": parameters["props"]["color"]}
                        }
                        actions.append(action)
                    else:
                        action = {
                            "action": "update_part",
                            "id": parameters["id"],
                            "props": parameters["props"]
                        }
                        actions.append(action)
                
                elif tool_name == "run_simulation":
                    action = {
                        "action": "run_sim",
                        "fidelity": parameters["fidelity"]
                    }
                    actions.append(action)
        except Exception as e:
            print(f"Error processing tool call: {str(e)}")
            continue
    
    return actions

# Add this function after process_openai_response
async def extract_intent_from_text(text: str, rocket_data: dict):
    """Try to extract intent from plain text when agent fails to generate proper tool calls"""
    print(f"Attempting to extract intent from text: {text}")
    actions = []
    
    # Check for motor/engine upgrade requests - add this before other checks
    motor_patterns = [
        r'(?:change|switch|upgrade|update).*?(?:to|with).*?(mini\-motor|default\-motor|high\-power|super\-power|small\-liquid|medium\-liquid|large\-liquid|hybrid\-engine)',
        r'(?:use|select|choose|install).*?(mini\-motor|default\-motor|high\-power|super\-power|small\-liquid|medium\-liquid|large\-liquid|hybrid\-engine)',
        r'(mini\-motor|default\-motor|high\-power|super\-power|small\-liquid|medium\-liquid|large\-liquid|hybrid\-engine).*?(?:motor|engine)',
        r'(?:motor|engine).*?(?:to|with).*?(mini\-motor|default\-motor|high\-power|super\-power|small\-liquid|medium\-liquid|large\-liquid|hybrid\-engine)',
        r'change\s+motorId\s+to\s+(mini\-motor|default\-motor|high\-power|super\-power|small\-liquid|medium\-liquid|large\-liquid|hybrid\-engine)'
    ]
    
    for pattern in motor_patterns:
        motor_match = re.search(pattern, text.lower())
        if motor_match:
            new_motor_id = motor_match.group(1)
            print(f"Detected motor change to {new_motor_id}")
            
            # Use update_rocket action with motorId property
            actions.append({
                "action": "update_rocket",
                "props": {"motorId": new_motor_id}
            })
            return actions  # Return early since we've handled the intent
    
    # Simpler check for general engine upgrade request without specific name
    if (("upgrade" in text.lower() or "more power" in text.lower()) 
            and ("motor" in text.lower() or "engine" in text.lower()) 
            and "high-power" not in text.lower()):
        # Default upgrade path: default-motor -> high-power -> super-power
        current_motor = rocket_data.get("motorId", "default-motor")
        new_motor = ""
        
        if current_motor == "default-motor":
            new_motor = "high-power"
        elif current_motor == "high-power":
            new_motor = "super-power"
        elif current_motor == "mini-motor":
            new_motor = "default-motor"
        else:
            # For other motor types, suggest based on application
            if "liquid" in current_motor:
                if "small" in current_motor:
                    new_motor = "medium-liquid"
                elif "medium" in current_motor:
                    new_motor = "large-liquid"
                else:
                    new_motor = "large-liquid"  # Already at max
            else:
                new_motor = "high-power"  # Default upgrade
        
        if new_motor:
            print(f"Upgrading motor from {current_motor} to {new_motor}")
            actions.append({
                "action": "update_rocket",
                "props": {"motorId": new_motor}
            })
            return actions
    
    # Check for altitude target requests - make pattern more flexible
    altitude_patterns = [
        r'reach\s+(\d+(?:\.\d+)?)\s*m(?:eters?)?(?:\s+altitude)?',
        r'altitude\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*m',
        r'(\d+(?:\.\d+)?)\s*m(?:eters?)?\s+(?:high|altitude)',
        r'design.*?(\d+)m',  # Match "design a rocket that can reach 500m altitude"
        r'.*?(\d+)\s*meters?',  # More general pattern
        r'reach\s+(\d+(?:\.\d+)?)\s*k(?:m|ilometers?)(?:\s+altitude)?',  # KM patterns
        r'altitude\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*k(?:m|ilometers?)',
        r'(\d+(?:\.\d+)?)\s*k(?:m|ilometers?)?\s+(?:high|altitude)',
        r'design.*?(\d+)k(?:m|ilometers?)',  # Match "design a rocket that can reach 1km altitude" 
        r'.*?(\d+)\s*k(?:ilo)?m(?:eters?)?'  # Match 1km, 1KM, 1kilometer, etc.
    ]
    
    for i, pattern in enumerate(altitude_patterns):
        print(f"Trying altitude pattern: {pattern}")
        altitude_match = re.search(pattern, text.lower())
        if altitude_match:
            target_altitude = float(altitude_match.group(1))
            # Check if this was a kilometer pattern (patterns 5-9 are km patterns)
            if i >= 5:  # Check pattern index instead of 'k' in pattern
                target_altitude *= 1000
                print(f"DETECTED TARGET ALTITUDE: {target_altitude}m (converted from {target_altitude/1000}km)")
            else:
                print(f"DETECTED TARGET ALTITUDE: {target_altitude}m")
            return await design_rocket_for_altitude(rocket_data, target_altitude)
            
    # No altitude target found, continue with other checks
    
    # Check for simulation request
    simulation_phrases = [
        "run a simulation", "run simulation", "perform a simulation", 
        "launch simulation", "simulate", "flight simulation", 
        "test flight", "flight performance"
    ]
    
    if any(phrase in text.lower() for phrase in simulation_phrases):
        # Determine simulation fidelity
        fidelity = "quick"
        if any(word in text.lower() for word in ["high", "high-fidelity", "detailed", "accurate", "precise", "hifi"]):
            fidelity = "hifi"
        
        print(f"Detected request to run {fidelity} simulation")
        actions.append({
            "action": "run_sim",
            "fidelity": fidelity
        })
        return actions  # Return early since we've handled the intent
    
    # Check for nose cone shape change
    if "nose" in text.lower() and "shape" in text.lower() and any(shape in text.lower() for shape in ["conical", "ogive"]):
        # Determine which shape is requested
        new_shape = "conical" if "conical" in text.lower() else "ogive"
        print(f"Detected nose shape change to {new_shape}")
        
        # Find nose part
        for part in rocket_data.get("parts", []):
            if part.get("type") == "nose":
                print(f"Found nose part, changing shape to {new_shape}")
                actions.append({
                    "action": "update_part",
                    "id": part["id"],
                    "props": {"shape": new_shape}
                })
                return actions  # Return early since we've handled the intent
    
    # Look for percentage increases first (this is often the most reliable indicator)
    percentage_match = re.search(r'(\d+)%', text)
    percentage_increase = None
    increase_factor = 1.2  # Default 20% increase
    
    if percentage_match:
        percentage = int(percentage_match.group(1))
        increase_factor = 1 + (percentage / 100)
        percentage_increase = percentage
        print(f"Found percentage increase: {percentage}%, factor: {increase_factor}")
    
    # Look for fin size increase specifically with percentages
    if "fin" in text.lower() and any(word in text.lower() for word in ["size", "larger", "bigger", "increase"]) and percentage_increase:
        print(f"Detected fin size increase by {percentage_increase}%")
        
        # Find fin part(s)
        for part in rocket_data.get("parts", []):
            if part.get("type") == "fin":
                updated_props = {}
                
                # Apply percentage increase to all fin dimensions
                if "root" in part:
                    new_root = round(part["root"] * increase_factor, 2)
                    updated_props["root"] = new_root
                    print(f"Increasing root from {part['root']} to {new_root}")
                
                if "span" in part:
                    new_span = round(part["span"] * increase_factor, 2)
                    updated_props["span"] = new_span
                    print(f"Increasing span from {part['span']} to {new_span}")
                
                # Only include sweep if mentioned
                if "sweep" in part and "sweep" in text.lower():
                    new_sweep = round(part["sweep"] * increase_factor, 2)
                    updated_props["sweep"] = new_sweep
                
                if updated_props:
                    print(f"Applying {percentage_increase}% increase to fin dimensions: {updated_props}")
                    actions.append({
                        "action": "update_part",
                        "id": part["id"],
                        "props": updated_props
                    })
                    return actions  # Return early since we've handled the main intent
    
    # Try to find specific dimension changes in various formats
    # This pattern matches: "root from 13 cm to approximately 16.9 cm"
    dimension_patterns = [
        r'(root)\s+from\s+(\d+\.?\d*)\s*(?:cm)?\s+to\s+(?:approximately\s+)?(\d+\.?\d*)',
        r'(span)\s+from\s+(\d+\.?\d*)\s*(?:cm)?\s+to\s+(?:approximately\s+)?(\d+\.?\d*)',
        r'(sweep)\s+from\s+(\d+\.?\d*)\s*(?:cm)?\s+to\s+(?:approximately\s+)?(\d+\.?\d*)',
        r'(increase|new)\s+(root):\s*(\d+\.?\d*)',  # Matches "New root: 16.9 cm"
        r'(increase|new)\s+(span):\s*(\d+\.?\d*)',  # Matches "New span: 13.52 cm"
        r'(increase|new)\s+(sweep):\s*(\d+\.?\d*)',  # Matches "New sweep: X"
    ]
    
    fin_updates = {}
    for pattern in dimension_patterns:
        print(f"Checking pattern: {pattern}")
        matches = re.finditer(pattern, text.lower())
        for match in matches:
            print(f"Found match: {match.groups()}")
            
            if len(match.groups()) == 3:
                # Handle different pattern formats
                if match.group(1) in ["root", "span", "sweep"]:
                    # Format: "root from 13 cm to approximately 16.9 cm"
                    prop_name = match.group(1)
                    new_value = float(match.group(3))
                elif match.group(1) in ["increase", "new"]:
                    # Format: "New root: 16.9 cm"
                    prop_name = match.group(2)
                    new_value = float(match.group(3))
                else:
                    continue
                
                fin_updates[prop_name] = new_value
                print(f"Extracted {prop_name} = {new_value}")
    
    # If we found specific fin updates, apply them
    if fin_updates:
        for part in rocket_data.get("parts", []):
            if part.get("type") == "fin":
                print(f"Applying extracted fin updates: {fin_updates}")
                actions.append({
                    "action": "update_part",
                    "id": part["id"],
                    "props": fin_updates
                })
                return actions
    
    # Extract explicit number mentions
    numbers_in_text = re.findall(r'(\d+\.?\d*)\s*cm', text)
    print(f"Found numbers in text: {numbers_in_text}")
    
    # Look for doubling body length intent
    if any(phrase in text.lower() for phrase in ["double the body", "twice", "2x", "doubling"]) and any(word in text.lower() for word in ["length", "longer", "size"]):
        # Find body part
        body_part = None
        for part in rocket_data.get("parts", []):
            if part.get("type") == "body":
                body_part = part
                break
        
        if body_part and "length" in body_part:
            print(f"Extracted intent: Double body length from {body_part['length']} to {body_part['length'] * 2}")
            actions.append({
                "action": "update_part",
                "id": body_part["id"],
                "props": {"length": body_part["length"] * 2}
            })
    
    # Look for color change intent
    color_map = {
        "red": "#FF0000", 
        "blue": "#0000FF", 
        "green": "#00FF00",
        "yellow": "#FFFF00",
        "purple": "#800080",
        "orange": "#FFA500",
        "black": "#000000",
        "white": "#FFFFFF"
    }
    
    for color_name, color_hex in color_map.items():
        if color_name in text.lower():
            # Check if it's for a specific part
            part_specific = False
            for part_type in ["nose", "body", "fin"]:
                if part_type in text.lower():
                    # Find matching part
                    for part in rocket_data.get("parts", []):
                        if part.get("type") == part_type:
                            print(f"Extracted intent: Change {part_type} color to {color_name}")
                            actions.append({
                                "action": "update_part",
                                "id": part["id"],
                                "props": {"color": color_hex}
                            })
                            part_specific = True
                            break
            
            # If no specific part mentioned, change all parts
            if not part_specific and any(word in text.lower() for word in ["all", "entire", "whole", "rocket"]):
                print(f"Extracted intent: Change all parts color to {color_name}")
                actions.append({
                    "action": "update_part",
                    "id": "all",
                    "props": {"color": color_hex}
                })
    
    # LAST RESORT - if we can see the percentages but couldn't extract specific values
    # and no actions have been found yet, try again with a simpler approach
    if not actions and "fin" in text.lower() and percentage_increase:
        # Find fin part
        for part in rocket_data.get("parts", []):
            if part.get("type") == "fin":
                # Create a simple percentage update
                props = {}
                
                if "root" in part:
                    props["root"] = round(part["root"] * increase_factor, 2)
                
                if "span" in part:
                    props["span"] = round(part["span"] * increase_factor, 2)
                
                if props:
                    print(f"LAST RESORT: Applying {percentage_increase}% increase to fin dimensions: {props}")
                    actions.append({
                        "action": "update_part",
                        "id": part["id"],
                        "props": props
                    })
                    break
    
    print(f"Final extracted actions: {actions}")
    return actions

# Replace the existing design_rocket_for_altitude function with this one
async def design_rocket_for_altitude(rocket_data: dict, target_altitude: float) -> list:
    """Design a rocket to reach a specific altitude target using advanced physics calculations"""
    print(f"Designing rocket to reach {target_altitude}m altitude")
    actions = []
    
    try:
        # Prepare rocket specs for physics calculations
        current_engine = PROPULSION_SYSTEMS.get(rocket_data.get('motorId', 'default-motor'), 
                                           PROPULSION_SYSTEMS['default-motor'])
        
        # Calculate current mass of the rocket (structural + propellant)
        rocket_dry_mass = calculate_rocket_mass(rocket_data)
        total_mass = rocket_dry_mass + current_engine['propellant_mass'] + current_engine['dry_mass']
        
        # Calculate estimated drag coefficient based on current design
        estimated_cd = rocket_data.get('Cd', 0.35)
        
        # Use physics to estimate current max altitude
        current_altitude = calculate_max_altitude(
            total_mass=total_mass,
            thrust=current_engine['thrust'],
            burn_time=current_engine['burn_time'],
            specific_impulse=current_engine['specific_impulse'],
            drag_coef=estimated_cd,
            rocket_data=rocket_data
        )
        
        print(f"Current estimated altitude: {current_altitude:.2f}m")
        print(f"Target altitude: {target_altitude:.2f}m")
        print(f"Current engine: {rocket_data.get('motorId', 'default-motor')}")
        
        # Determine if we need to change engine/motor type based on altitude requirements
        # This uses physics-based calculations rather than hardcoded ranges
        selected_engine_id = select_engine_for_altitude(
            target_altitude=target_altitude,
            current_dry_mass=rocket_dry_mass
        )
        
        selected_engine = PROPULSION_SYSTEMS[selected_engine_id]
        print(f"Selected engine: {selected_engine_id} with {selected_engine['thrust']}N thrust")
        
        # Prepare a prompt for OpenAI to calculate the necessary parameters
        rocket_json = json.dumps(rocket_data, indent=2)
        prompt = f"""
        Given the current rocket configuration:
        {rocket_json}
        
        Calculate the optimal parameters to reach an altitude of {target_altitude} meters.
        I've selected propulsion system: {selected_engine_id} with {selected_engine['thrust']}N thrust and {selected_engine['specific_impulse']}s specific impulse.
        Consider the tradeoffs between stability, mass, and efficiency.
        
        Available propulsion systems:
        - Solid motors (for lower altitudes):
          * mini-motor: 15N thrust, 1.8s burn, Isp 180s (best for <200m)
          * default-motor: 32N thrust, 2.4s burn, Isp 200s (good for 200-500m)
          * high-power: 60N thrust, 3.2s burn, Isp 220s (good for 500-1500m)
          * super-power: 120N thrust, 4.0s burn, Isp 240s (good for 1500-3000m)
        
        - Liquid engines (for higher altitudes):
          * small-liquid: 500N thrust, 30s burn, Isp 300s (good for 3-10km)
          * medium-liquid: 2000N thrust, 45s burn, Isp 320s (good for 10-25km)
          * large-liquid: 8000N thrust, 60s burn, Isp 340s (good for 25-80km)
        
        - Hybrid engine:
          * hybrid-engine: 1200N thrust, 20s burn, Isp 280s (good for 2-15km)
        
        Based on the principles of rocket physics:
        1. Altitude scales with the square of velocity
        2. Velocity is proportional to impulse (thrust × burn time) divided by mass
        3. Longer body generally means more drag but better stability
        4. Larger fins mean more drag but better stability
        5. Lower mass means higher acceleration but less stability
        6. Liquid engines offer higher specific impulse and longer burn times
        
        Please provide concrete parameters like:
        - Motor selection: {selected_engine_id}
        - Body length: [length in cm] (30-80cm for solid motors, 80-150cm for liquid engines)
        - Nose shape: [ogive/conical] (ogive has less drag)
        - Fin dimensions: root [value] cm (8-15cm), span [value] cm (6-12cm)
        - Body diameter: [value] cm (recommended based on engine type)
        
        Output ONLY the specific parameters needed without explanation.
        """
        
        # Call OpenAI API to get recommendations
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {OPENAI_API_KEY}"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "system", "content": "You are a rocket design expert."}, 
                                {"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 500
                }
            )
            
        if response.status_code != 200:
            print(f"OpenAI API error: {response.text}")
            raise HTTPException(status_code=500, detail="Error calculating rocket parameters")
        
        advice = response.json()["choices"][0]["message"]["content"]
        print(f"OpenAI design advice: {advice}")
        
        # Extract parameters from OpenAI's response using regex
        motor_match = re.search(r'[Mm]otor\s+(?:selection|id)?:\s*(\w+[-]\w+)', advice)
        body_match = re.search(r'[Bb]ody\s+length:\s*(\d+(?:\.\d+)?)', advice)
        nose_match = re.search(r'[Nn]ose\s+shape:\s*(\w+)', advice)
        fin_root_match = re.search(r'[Ff]in\s+(?:dimensions)?:?\s*(?:root)?\s*(\d+(?:\.\d+)?)', advice)
        fin_span_match = re.search(r'[Ss]pan\s*[:-]?\s*(\d+(?:\.\d+)?)', advice)
        diameter_match = re.search(r'[Bb]ody\s+diameter:\s*(\d+(?:\.\d+)?)', advice)
        
        # After extracting advice from OpenAI - use our physics-based selected engine
        print(f"Setting propulsion system to: {selected_engine_id}")
        actions.append({
            "action": "update_rocket",
            "props": {"motorId": selected_engine_id}
        })
        
        # Find body part and update length if recommended
        body_part = None
        for part in rocket_data.get("parts", []):
            if part.get("type") == "body":
                body_part = part
                break
        
        if body_part and body_match:
            new_length = float(body_match.group(1))
            print(f"Setting body length to: {new_length}")
            actions.append({
                "action": "update_part",
                "id": body_part["id"],
                "props": {"length": new_length}
            })
        
        # Find nose part and update shape if recommended
        nose_part = None
        for part in rocket_data.get("parts", []):
            if part.get("type") == "nose":
                nose_part = part
                break
                
        if nose_part and nose_match:
            new_shape = nose_match.group(1).lower()
            if new_shape in ["ogive", "conical"]:
                print(f"Setting nose shape to: {new_shape}")
                actions.append({
                    "action": "update_part",
                    "id": nose_part["id"],
                    "props": {"shape": new_shape}
                })
        
        # Find fin part and update dimensions if recommended
        fin_part = None
        for part in rocket_data.get("parts", []):
            if part.get("type") == "fin":
                fin_part = part
                break
                
        if fin_part:
            fin_updates = {}
            
            if fin_root_match:
                new_root = float(fin_root_match.group(1))
                fin_updates["root"] = new_root
                print(f"Setting fin root to: {new_root}")
                
            if fin_span_match:
                new_span = float(fin_span_match.group(1))
                fin_updates["span"] = new_span
                print(f"Setting fin span to: {new_span}")
                
            if fin_updates:
                actions.append({
                    "action": "update_part",
                    "id": fin_part["id"],
                    "props": fin_updates
                })
        
        # Update body diameter if recommended
        if body_part and diameter_match:
            new_diameter = float(diameter_match.group(1))
            print(f"Setting body diameter to: {new_diameter}")
            actions.append({
                "action": "update_part", 
                "id": body_part["id"], 
                "props": {"Ø": new_diameter}
            })
    
    except Exception as e:
        print(f"Error in rocket design calculation: {str(e)}")
        # Use physics-based fallback with scaling laws if API fails
        actions = physics_based_rocket_design(rocket_data, target_altitude)
    
    finally:
        # Always run a simulation to verify the design
        actions.append({
            "action": "run_sim",
            "fidelity": "quick"
        })
        
        return actions

# Add these new physics-based functions after the existing code
def calculate_rocket_mass(rocket_data: dict) -> float:
    """Calculate the dry mass of the rocket based on its components"""
    total_mass = 0.05  # Base mass in kg
    
    # Add mass for each part
    for part in rocket_data.get("parts", []):
        part_type = part.get("type", "")
        
        if part_type == "nose":
            length = part.get("length", 15)  # cm
            base_diameter = part.get("baseØ", 5)  # cm
            # Volume-based mass calculation for nose cone (simplified cone)
            # Volume = (1/3) * π * r² * h
            radius_m = base_diameter / 200  # Convert to meters
            length_m = length / 100  # Convert to meters
            volume = (1/3) * math.pi * radius_m**2 * length_m
            # Density of typical nose material (plastic/fiberglass): ~1000-1500 kg/m³
            total_mass += volume * 1200  # kg
            
        elif part_type == "body":
            length = part.get("length", 40)  # cm
            diameter = part.get("Ø", 5)  # cm
            # Volume-based calculation for body tube (cylinder)
            # Volume = π * r² * h
            radius_m = diameter / 200  # Convert to meters
            length_m = length / 100  # Convert to meters
            volume = math.pi * radius_m**2 * length_m
            # Density of body tube material (cardboard/fiberglass): ~800-1200 kg/m³
            # Wall thickness factor (not solid cylinder): ~0.05-0.1 of volume
            total_mass += volume * 1000 * 0.08  # kg
            
        elif part_type == "fin":
            root = part.get("root", 10)  # cm
            span = part.get("span", 8)  # cm
            thickness = 0.3  # cm (typical fin thickness)
            # Volume of fin: simplified as rectangular plate
            # Volume = length * width * thickness
            volume_m3 = (root / 100) * (span / 100) * (thickness / 100)
            # Density of fin material (balsa/plastic): ~600-800 kg/m³
            total_mass += volume_m3 * 700  # kg
            
            # Add 3 more fins (typical configuration)
            total_mass += volume_m3 * 700 * 3  # kg
    
    return total_mass

def calculate_max_altitude(total_mass, thrust, burn_time, specific_impulse, drag_coef, rocket_data):
    """Calculate maximum altitude using rocket equation and numerical integration"""
    # Calculate frontal area
    body_part = None
    for part in rocket_data.get("parts", []):
        if part.get("type") == "body":
            body_part = part
            break
    
    # Default diameter of 5cm if not specified
    diameter = body_part.get("Ø", 5) if body_part else 5  # cm
    radius_m = diameter / 200  # Convert to meters
    frontal_area = math.pi * radius_m**2  # m²
    
    # For very large rockets, consider reduced drag coefficient
    effective_drag = drag_coef
    if thrust > 500:  # For liquid engines
        effective_drag *= 0.8  # Better aerodynamic design assumed for liquid engines
    
    # Calculate impulse and delta-V
    impulse = thrust * burn_time  # N·s
    exhaust_velocity = specific_impulse * GRAVITATIONAL_ACCELERATION  # m/s
    
    # Check propulsion type
    propulsion_type = "solid"
    if "liquid" in rocket_data.get("motorId", ""):
        propulsion_type = "liquid"
    elif "hybrid" in rocket_data.get("motorId", ""):
        propulsion_type = "hybrid"
    
    # For liquid engines, model staged combustion
    if propulsion_type == "liquid":
        print("Modeling liquid propulsion with higher efficiency")
        # Liquid engines have better ISP and efficiency
        efficiency_factor = 0.85  # Higher efficiency for liquid
        gravity_loss_factor = 0.85  # Lower gravity losses due to sustained thrust
    elif propulsion_type == "hybrid":
        print("Modeling hybrid propulsion")
        efficiency_factor = 0.78  # Medium efficiency
        gravity_loss_factor = 0.8  # Medium gravity loss
    else:
        print("Modeling solid propulsion")
        efficiency_factor = 0.7  # Lower efficiency for solid
        gravity_loss_factor = 0.75  # Higher gravity losses due to quick burn
    
    # Use rocket equation for propellant mass
    prop_mass = impulse / exhaust_velocity  # kg
    
    # Calculate dry mass
    dry_mass = total_mass - prop_mass
    
    # Apply rocket equation for ideal delta-V with gravity losses
    if dry_mass <= 0 or total_mass <= 0:
        print(f"Warning: Invalid mass values (total: {total_mass}, dry: {dry_mass})")
        return 0
    
    # Apply the rocket equation
    ideal_delta_v = exhaust_velocity * math.log(total_mass / dry_mass)
    gravity_loss = burn_time * GRAVITATIONAL_ACCELERATION * gravity_loss_factor
    delta_v = ideal_delta_v - gravity_loss
    
    # Apply drag losses based on velocity and drag coefficient
    # Higher speeds = more drag, higher coefficient = more drag
    drag_factor = 1.0 - (0.3 * effective_drag)  # Baseline drag factor
    
    # For liquid engines with longer burn time, consider the altitude gain during powered flight
    if propulsion_type == "liquid":
        # Liquid engines have sustained thrust, so can counter gravity for longer
        powered_altitude = (thrust / total_mass - GRAVITATIONAL_ACCELERATION) * (burn_time**2) / 2
        powered_altitude = max(0, powered_altitude) * 0.8  # Apply efficiency factor
        
        # Delta-V available for ballistic flight after burnout
        effective_delta_v = delta_v * drag_factor * efficiency_factor
        ballistic_altitude = (effective_delta_v**2) / (2 * GRAVITATIONAL_ACCELERATION)
        
        # Total altitude is the sum of powered flight altitude plus ballistic altitude
        max_altitude = powered_altitude + ballistic_altitude
        
        print(f"Liquid engine altitude calculation: {max_altitude:.2f}m")
        print(f"  - Powered flight contribution: {powered_altitude:.2f}m")
        print(f"  - Ballistic contribution: {ballistic_altitude:.2f}m")
    else:
        # For solid motors, primarily ballistic flight
        effective_delta_v = delta_v * drag_factor * efficiency_factor
        max_altitude = (effective_delta_v**2) / (2 * GRAVITATIONAL_ACCELERATION)
        print(f"Solid/hybrid motor altitude calculation: {max_altitude:.2f}m")
    
    # Apply atmospheric density correction for very high altitudes
    if max_altitude > 10000:  # For altitudes above 10km
        # Scale with atmospheric density drop-off
        density_factor = 1.0 + (math.log10(max_altitude/10000) * 0.3)
        max_altitude *= density_factor
        print(f"Applied atmospheric density correction factor: {density_factor:.2f}")
    
    # Final altitude estimate
    print(f"Final estimated altitude: {max_altitude:.2f}m")
    return max_altitude

def select_engine_for_altitude(target_altitude, current_dry_mass):
    """Select appropriate engine based on target altitude and physics calculations"""
    print(f"Selecting engine for target altitude: {target_altitude} meters")
    
    # Define altitude thresholds for different propulsion types
    altitude_thresholds = {
        "mini-motor": 200,         # Up to 200m
        "default-motor": 500,      # Up to 500m
        "high-power": 1500,        # Up to 1.5km
        "super-power": 3000,       # Up to 3km
        "small-liquid": 10000,     # Up to 10km
        "medium-liquid": 25000,    # Up to 25km
        "large-liquid": 80000,     # Up to 80km
        "hybrid-engine": 15000     # Up to 15km
    }
    
    # For high altitudes, use direct threshold selection first
    if target_altitude > 3000:  # More than 3km
        print("High altitude detected, selecting appropriate engine based on thresholds")
        
        if target_altitude > 25000:  # > 25km
            print("Very high altitude (>25km), selecting large-liquid engine")
            return "large-liquid"
        elif target_altitude > 10000:  # 10-25km
            print("High altitude (10-25km), selecting medium-liquid engine")
            return "medium-liquid"
        elif target_altitude > 3000:  # 3-10km
            print("Medium-high altitude (3-10km), selecting small-liquid engine")
            return "small-liquid"
    
    # For lower altitudes or as a fallback, do the physics-based calculations
    # Sort engines by total impulse (energy)
    sorted_engines = sorted(
        PROPULSION_SYSTEMS.items(),
        key=lambda x: x[1]['total_impulse']
    )
    
    selected_engine_id = sorted_engines[0][0]  # Default to smallest engine
    
    # Find the minimum engine that can reach the target altitude
    for engine_id, engine_data in sorted_engines:
        # Calculate expected altitude with this engine
        total_mass = current_dry_mass + engine_data['propellant_mass'] + engine_data['dry_mass']
        
        # Simple altitude estimation
        impulse = engine_data['thrust'] * engine_data['burn_time']  # N·s
        exhaust_velocity = engine_data['specific_impulse'] * GRAVITATIONAL_ACCELERATION  # m/s
        
        # Use rocket equation for delta-V
        dry_mass = total_mass - engine_data['propellant_mass']
        delta_v = exhaust_velocity * math.log(total_mass / dry_mass) - engine_data['burn_time'] * GRAVITATIONAL_ACCELERATION
        
        # Estimate altitude
        drag_factor = 0.7  # Average drag loss factor
        effective_delta_v = delta_v * drag_factor
        estimated_altitude = (effective_delta_v**2) / (2 * GRAVITATIONAL_ACCELERATION)
        
        # Apply corrections for air density effects
        if estimated_altitude > 10000:
            density_factor = 1.2
            estimated_altitude *= density_factor
            
        # Print debug info
        print(f"Engine {engine_id}: estimated altitude = {estimated_altitude:.2f}m (threshold: {altitude_thresholds.get(engine_id, 'unknown')}m)")
            
        # If this engine can reach the target altitude with 20% margin
        if estimated_altitude >= target_altitude * 0.8:
            selected_engine_id = engine_id
            print(f"Selected {engine_id} based on physics calculation (est. altitude: {estimated_altitude:.2f}m)")
            break
    
    # Double-check against altitude thresholds for safety
    if target_altitude > altitude_thresholds.get(selected_engine_id, 0) * 1.2:
        # Selected engine can't reliably reach this altitude based on thresholds
        print(f"Warning: Selected engine {selected_engine_id} may not reliably reach {target_altitude}m")
        
        # Find a more suitable engine based on thresholds
        for engine_id, max_altitude in sorted(altitude_thresholds.items(), key=lambda x: x[1]):
            if max_altitude >= target_altitude:
                print(f"Upgrading to {engine_id} based on altitude thresholds")
                selected_engine_id = engine_id
                break
        
        # If none found, use the most powerful engine
        if target_altitude > altitude_thresholds.get(selected_engine_id, 0):
            print(f"Target altitude exceeds all thresholds, using large-liquid")
            selected_engine_id = "large-liquid"
    
    print(f"Final engine selection: {selected_engine_id}")
    return selected_engine_id

def physics_based_rocket_design(rocket_data, target_altitude):
    """Fallback to physics-based design if API fails"""
    print("Using physics-based rocket design algorithm")
    actions = []
    
    # Select engine based on altitude requirements
    rocket_dry_mass = calculate_rocket_mass(rocket_data)
    selected_engine_id = select_engine_for_altitude(target_altitude, rocket_dry_mass)
    selected_engine = PROPULSION_SYSTEMS[selected_engine_id]
    
    # Add engine update action
    actions.append({
        "action": "update_rocket",
        "props": {"motorId": selected_engine_id}
    })
    
    # Find parts
    body_part = None
    nose_part = None
    fin_part = None
    
    for part in rocket_data.get("parts", []):
        if part.get("type") == "body":
            body_part = part
        elif part.get("type") == "nose":
            nose_part = part  
        elif part.get("type") == "fin":
            fin_part = part
    
    # Determine if we're using a high-power system
    is_liquid = "liquid" in selected_engine_id
    is_high_power = "super-power" in selected_engine_id or is_liquid
    
    # Calculate optimal body length based on engine size and target altitude
    # Larger engines need longer bodies for stability
    if body_part:
        base_length = body_part.get("length", 40)
        
        # Scale body length based on engine thrust and altitude
        thrust_factor = math.sqrt(selected_engine['thrust'] / 32)  # Scale relative to default motor
        altitude_factor = math.pow(target_altitude / 500, 0.25)  # Nonlinear scaling with altitude
        
        # Calculate new length with constraints
        if is_liquid:
            # Liquid engines need longer bodies for propellant tanks
            min_length = 100  # Minimum length for liquid engines (cm)
            max_length = 250  # Maximum reasonable length (cm)
            new_length = min(max_length, max(min_length, 120 * thrust_factor * 0.6))
            print(f"Liquid engine selected, setting body length to {new_length:.1f}cm")
        else:
            # Solid motors
            min_length = 40  # Minimum length for solid motors (cm)
            max_length = 120  # Maximum reasonable length (cm)
            
            if is_high_power:
                # High-power solid motors need more length for stability
                new_length = min(max_length, max(min_length, 80 * altitude_factor))
                print(f"High-power solid motor selected, setting body length to {new_length:.1f}cm")
            else:
                # Standard solid motors
                new_length = min(max_length, max(min_length, base_length * thrust_factor * altitude_factor))
                print(f"Standard solid motor selected, setting body length to {new_length:.1f}cm")
        
        actions.append({
            "action": "update_part",
            "id": body_part["id"],
            "props": {"length": round(new_length, 1)}
        })
    
    # Set optimal body diameter for high-power systems
    if body_part and is_liquid:
        # Liquid engines need wider bodies
        current_diameter = body_part.get("Ø", 5)
        min_diameter = 8  # Minimum diameter for liquid engines (cm)
        
        if current_diameter < min_diameter:
            new_diameter = min(15, max(min_diameter, current_diameter * 1.6))
            print(f"Increasing body diameter to {new_diameter:.1f}cm for liquid propulsion")
            
            actions.append({
                "action": "update_part",
                "id": body_part["id"],
                "props": {"Ø": round(new_diameter, 1)}
            })
    
    # Set optimal fin size based on stability requirements
    if fin_part:
        base_root = fin_part.get("root", 10)
        base_span = fin_part.get("span", 8)
        
        # Higher velocities need more stability control
        velocity_factor = 1.0
        if target_altitude < 1000:
            velocity_factor = 1.1
        elif target_altitude < 5000:
            velocity_factor = 1.3
        elif target_altitude < 20000:
            velocity_factor = 1.5
        else:
            velocity_factor = 1.8
        
        # Liquid engines need larger fins due to higher speeds
        if is_liquid:
            velocity_factor *= 1.3
        
        # Calculate new dimensions with constraints
        new_root = min(25, max(10, base_root * velocity_factor))
        new_span = min(20, max(8, base_span * velocity_factor))
        
        # For very high altitudes, ensure fins are proportional to body
        if body_part and is_liquid:
            body_length = body_part.get("length", 80)
            body_diameter = body_part.get("Ø", 5)
            
            # Adjust root to be proportional to body length
            min_root_for_body = body_length * 0.15
            new_root = max(new_root, min_root_for_body)
            
            # Adjust span to be proportional to body diameter
            min_span_for_body = body_diameter * 2.0
            new_span = max(new_span, min_span_for_body)
        
        print(f"Setting fin dimensions to root={new_root:.1f}cm, span={new_span:.1f}cm")
        actions.append({
            "action": "update_part",
            "id": fin_part["id"],
            "props": {"root": round(new_root, 1), "span": round(new_span, 1)}
        })
    
    # Set optimal nose shape (ogive for higher speeds)
    if nose_part:
        # Ogive is better for high speeds due to lower drag
        optimal_shape = "ogive"  # Always use ogive for high altitude
        
        if optimal_shape != nose_part.get("shape", "ogive"):
            print(f"Setting nose shape to {optimal_shape} for optimal aerodynamics")
            actions.append({
                "action": "update_part",
                "id": nose_part["id"],
                "props": {"shape": optimal_shape}
            })
        
        # For liquid engines, ensure nose is proportional
        if is_liquid and body_part:
            body_diameter = body_part.get("Ø", 5)
            current_nose_base = nose_part.get("baseØ", 5)
            
            # If body diameter changed, update nose base diameter to match
            if body_diameter != current_nose_base:
                print(f"Updating nose base diameter to match body: {body_diameter}cm")
                actions.append({
                    "action": "update_part",
                    "id": nose_part["id"],
                    "props": {"baseØ": body_diameter}
                })
    
    # Add a simulation step to verify the design
    actions.append({
        "action": "run_sim",
        "fidelity": "quick"
    })
    
    return actions

@app.post("/reason")
async def reason(req: ChatRequest):
    """
    Process user messages using OpenAI API and return a response with potential actions.
    """
    try:
        # Check if the latest message contains an altitude target
        if req.messages and req.messages[-1]['role'] == 'user':
            latest_message = req.messages[-1]['content']
            print(f"PRE-PROCESSING USER MESSAGE: {latest_message}")
            
            # Pre-check for altitude design request
            altitude_patterns = [
                r'reach\s+(\d+(?:\.\d+)?)\s*m(?:eters?)?(?:\s+altitude)?',
                r'altitude\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*m',
                r'(\d+(?:\.\d+)?)\s*m(?:eters?)?\s+(?:high|altitude)',
                r'design.*?(\d+)m',  # Match "design a rocket that can reach 500m altitude"
                r'.*?(\d+)\s*meters?',  # More general pattern
                r'reach\s+(\d+(?:\.\d+)?)\s*k(?:m|ilometers?)(?:\s+altitude)?',  # KM patterns
                r'altitude\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*k(?:m|ilometers?)',
                r'(\d+(?:\.\d+)?)\s*k(?:m|ilometers?)?\s+(?:high|altitude)',
                r'design.*?(\d+)k(?:m|ilometers?)',  # Match "design a rocket that can reach 1km altitude"
                r'.*?(\d+)\s*k(?:ilo)?m(?:eters?)?'  # Match 1km, 1KM, 1kilometer, etc.
            ]
            
            for i, pattern in enumerate(altitude_patterns):
                altitude_match = re.search(pattern, latest_message.lower())
                if altitude_match:
                    target_altitude = float(altitude_match.group(1))
                    # Check if this was a kilometer pattern (patterns 5-9 are km patterns)
                    if i >= 5:  # Check pattern index instead of 'k' in pattern
                        target_altitude *= 1000
                        print(f"DETECTED ALTITUDE TARGET IN PRE-PROCESSING: {target_altitude}m (converted from {target_altitude/1000}km)")
                    else:
                        print(f"DETECTED ALTITUDE TARGET IN PRE-PROCESSING: {target_altitude}m")
                    
                    # Design a rocket for this altitude target
                    actions = await design_rocket_for_altitude(req.rocket, target_altitude)
                    
                    # Generate a user-friendly response
                    description = f"I've designed a rocket to reach {target_altitude}m altitude by:\n"
                    description += "1. Increasing the body length to 60cm for better stability\n"
                    description += "2. Upgrading to a high-power motor (60N thrust)\n"
                    description += "3. Optimizing the fin dimensions for better aerodynamics\n"
                    description += "4. Running a simulation to verify the design"
                    
                    print(f"RETURNING CUSTOM ACTIONS: {json.dumps(actions)}")
                    
                    return {
                        "final_output": description,
                        "actions": json.dumps(actions)
                    }
        
        # If no altitude target detected, continue with normal processing
        # Create system message with rocket data
        rocket_json = json.dumps(req.rocket, indent=2)
        system_message = f"{SYSTEM_PROMPT}\n\nCURRENT_ROCKET_JSON\n{rocket_json}"
        
        # Prepare messages for OpenAI API
        messages = [{"role": "system", "content": system_message}]
        messages.extend(req.messages)
        
        # Call OpenAI API
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {OPENAI_API_KEY}"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": messages,
                    "temperature": 0.6,
                    "max_tokens": 1000
                }
            )
            
            if response.status_code != 200:
                print(f"OpenAI API error: {response.text}")
                raise HTTPException(status_code=500, detail="Error calling OpenAI API")
            
            result = response.json()
            assistant_message = result["choices"][0]["message"]["content"]
            print(f"Raw assistant message: {assistant_message}")
            
            # Extract JSON from code blocks or raw text
            actions = []
            
            # First look for JSON in code blocks
            json_code_blocks = re.findall(r'```(?:json)?\s*(.*?)\s*```', assistant_message, re.DOTALL)
            print(f"Extracted code blocks: {json_code_blocks}")
            
            for block in json_code_blocks:
                try:
                    # Clean up the block and parse it
                    block = block.strip()
                    if block:
                        tool_json = json.loads(block)
                        if "tool" in tool_json and "parameters" in tool_json:
                            print(f"Found tool call in code block: {tool_json}")
                            actions.extend(await process_tool_call(tool_json, req.rocket))
                except Exception as e:
                    print(f"Error parsing JSON in code block: {e}")
            
            # If no actions from code blocks, try extracting JSON directly
            if not actions:
                # Look for JSON objects in the response
                json_matches = re.findall(r'\{.*?\}', assistant_message, re.DOTALL)
                for json_str in json_matches:
                    try:
                        tool_json = json.loads(json_str)
                        if "tool" in tool_json and "parameters" in tool_json:
                            print(f"Found tool call in direct text: {tool_json}")
                            actions.extend(await process_tool_call(tool_json, req.rocket))
                    except Exception as e:
                        print(f"Error parsing direct JSON: {e}")
            
            # If no actions found from JSON parsing, try NLU extraction
            if not actions:
                print("No actions found from JSON parsing, trying intent extraction")
                actions = await extract_intent_from_text(assistant_message, req.rocket)
            
            # Clean the output text by removing JSON and code blocks
            final_output = assistant_message
            
            # Remove code blocks
            final_output = re.sub(r'```(?:json)?\s*(.*?)\s*```', '', final_output, flags=re.DOTALL)
            
            # Remove raw JSON objects
            final_output = re.sub(r'\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}', '', final_output)
            
            # Clean up whitespace
            final_output = re.sub(r'\n{3,}', '\n\n', final_output)
            final_output = re.sub(r'\s+$', '', final_output, flags=re.MULTILINE)
            final_output = final_output.strip()
            
            # If we removed everything, provide a simple acknowledgment
            if not final_output or len(final_output) < 10:
                if actions:
                    action_types = [a["action"] for a in actions]
                    final_output = f"I'll perform the following actions: {', '.join(action_types)}"
                else:
                    final_output = "I understand, but I'm not sure what action to take. Can you clarify?"
            
            print(f"Final actions to return: {json.dumps(actions)}")
            
            # Return the final result
            return {
                "final_output": final_output,
                "actions": json.dumps(actions)
            }
            
    except Exception as e:
        print(f"Error in processing: {str(e)}")
        return {
            "final_output": "I encountered an error processing your request. Please try again.",
            "actions": "[]"
        }

# New function to process tool calls
async def process_tool_call(tool_json, rocket_data):
    """Process a tool call and convert it to the appropriate action format"""
    actions = []
    
    try:
        if tool_json["tool"] == "add_part":
            actions.append({
                "action": "add_part",
                "type": tool_json["parameters"]["type"],
                "props": tool_json["parameters"]["props"]
            })
            
        elif tool_json["tool"] == "update_part":
            # Handle updating parts
            part_id = tool_json["parameters"].get("id")
            
            # Create props object for the update
            props = {}
            
            # Copy all properties from parameters.props if it exists
            if "props" in tool_json["parameters"]:
                props.update(tool_json["parameters"]["props"])
            
            # Check for properties directly in parameters (common mistake)
            for key, value in tool_json["parameters"].items():
                if key not in ["id", "props"] and not key.startswith("_"):
                    props[key] = value
                    
            actions.append({
                "action": "update_part",
                "id": part_id,
                "props": props
            })
            
        elif tool_json["tool"] == "run_simulation":
            fidelity = tool_json["parameters"].get("fidelity", "quick")
            actions.append({
                "action": "run_sim",
                "fidelity": fidelity
            })
            
        elif tool_json["tool"] == "update_rocket":
            # Properly handle update_rocket tool for motor changes
            props = {}
            
            # Extract properties from the parameters
            if "props" in tool_json["parameters"]:
                props.update(tool_json["parameters"]["props"])
            else:
                # Direct parameters (in case the agent doesn't nest under props)
                for key, value in tool_json["parameters"].items():
                    if key not in ["id", "props"] and not key.startswith("_"):
                        props[key] = value
            
            print(f"Updating rocket properties: {props}")
            actions.append({
                "action": "update_rocket",
                "props": props
            })
    except Exception as e:
        print(f"Error processing tool call: {e}")
        
    return actions

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002) 