import os, json, uvicorn, re
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
    
    # Look for motor updates
    if any(word in text.lower() for word in ["motor", "thrust", "engine", "power"]):
        # Check for numeric values that might indicate thrust
        thrust_match = re.search(r'thrust[:\s]+(\d+)', text.lower())
        if thrust_match:
            thrust_value = int(thrust_match.group(1))
            print(f"Extracted motor thrust update: {thrust_value}")
            actions.append({
                "action": "update_part",
                "id": rocket_data.get("motorId", "default-motor"),
                "props": {"thrust": thrust_value}
            })
            # Also update the rocket directly
            actions.append({
                "action": "update_rocket",
                "props": {"motorId": rocket_data.get("motorId", "default-motor")}
            })
            return actions  # Return early since we've handled the intent
    
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

@app.post("/reason")
async def reason(req: ChatRequest):
    """
    Process user messages using OpenAI API and return a response with potential actions.
    """
    try:
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
    except Exception as e:
        print(f"Error processing tool call: {e}")
        
    return actions

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002) 