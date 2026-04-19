
:

## Core Files and Their Functions

### 1. Data Model & State Management
- **`types/rocket.d.ts`**: Contains TypeScript interfaces for the rocket data model.
  - Defines `PartBase`, `Nose`, `Body`, `Fin`, and `Rocket` types
  - Structures all rocket components

- **`lib/store.ts`**: Manages application state using Zustand.
  - Defines `DEFAULT_ROCKET` configuration
  - Implements `useRocket` store with:
    - `rocket`: Current rocket data
    - `sim`: Simulation results
    - `updateRocket`: Function to modify rocket properties
    - `setSim`: Function to update simulation results

### 2. Simulation & Physics
- **`lib/ai/actions.ts`**: Handles rocket simulations and agent actions.
  - `propulsionSystems`: Complete database of engine types and specifications
  - `runQuickSim()`: Client-side physics simulation with specific handling for liquid/solid engines
  - `runHighFiSim()`: Server-side high-fidelity simulation using API
  - `estimateRocketMass()`: Calculates rocket mass based on component dimensions
  - `calculateStability()`: Computes stability margin in calibers
  - `dispatchActions()`: Processes agent actions (update parts, run simulations)

- **`services/rocketpy/app.py`**: High-fidelity physics simulation service.
  - Uses RocketPy library for accurate flight simulation
  - Exposes `/simulate` endpoint for detailed calculations
  - Models atmospheric conditions, thrust curves, and aerodynamics

### 3. AI Agent & NLP Processing
- **`services/agentpy/app.py`**: OpenAI Agent SDK-based service.
  - Processes natural language rocket design requests
  - Implements advanced physics calculations for altitude estimations
  - Contains propulsion system specifications and engine selection logic
  - Functions:
    - `process_openai_response()`: Extracts actions from AI responses
    - `extract_intent_from_text()`: Analyzes text when JSON parsing fails
    - `calculate_max_altitude()`: Physics-based altitude calculations
    - `select_engine_for_altitude()`: Chooses appropriate engine for target altitude
    - `physics_based_rocket_design()`: Generates optimal rocket designs

- **`app/api/agent/route.ts`**: Next.js API route that proxies requests to the agent service.

### 4. UI Components
- **`components/ChatPanel.tsx`**: Implements the chat interface.
  - Manages message history and user inputs
  - Communicates with agent API
  - Dispatches returned actions

- **`components/panels/MiddlePanel.tsx`**: 3D rocket visualization.
  - Contains `RocketModel` for 3D rendering
  - `RocketSimulation` for animating flights
  - Extracts dimensions from store data

- **`components/panels/RightPanel.tsx`**: Displays metrics and chat.
  - Shows performance metrics (thrust, altitude, etc.)
  - Presents engine specifications
  - Contains `MetricChart` and `PhysicsBadge` components

- **`components/panels/LeftPanel.tsx`**: File browser and settings.
  - Manages tab switching between files and settings
  - Shows file listing and configuration options

- **`app/page.tsx`**: Main application layout.
  - Implements responsive panel layout
  - Manages panel collapse/expand behavior

### 5. Infrastructure
- **`docker-compose.yml`**: Defines three services:
  - `web`: Next.js frontend
  - `agentpy`: Python agent service
  - `rocketpy`: Physics simulation service

- **`services/agentpy/Dockerfile` & `services/rocketpy/Dockerfile`**: Container specifications.

## Data Flow & System Architecture

1. **User Input Flow**:
   - User enters text in `ChatPanel`
   - Request sent to `/api/agent` endpoint
   - Next.js API forwards to Python agent service
   - Agent processes request and generates actions
   - Actions dispatched to modify rocket or run simulations
   - UI updates to reflect changes

2. **Simulation Flow**:
   - `runQuickSim()`: Fast client-side approximation using physics formulas
   - `runHighFiSim()`: Detailed server-side calculation using RocketPy
   - Both update the store with simulation results
   - Metrics display in RightPanel updates automatically

3. **Physics Model**:
   - Liquid engines use rocket equation with staged combustion modeling
   - Solid motors use simpler ballistic calculations
   - Advanced corrections for atmospheric effects at high altitudes
   - Stability calculated based on fin area and body dimensions

The system uses a microservices architecture with:
- React/Next.js frontend for visualization and UI
- Python/FastAPI services for AI processing and physics
- Communication via REST API endpoints
- State management with Zustand

All components work together to provide a seamless experience from natural language input to 3D rocket visualization and flight simulation.
