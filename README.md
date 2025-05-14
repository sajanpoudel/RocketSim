# 🚀 ROCKETv1

A modern model rocket design and simulation platform using Next.js, React Three Fiber, and OpenAI Agents SDK.

## Overview

ROCKETv1 is an educational platform that allows users to design, visualize, and simulate model rockets using natural language commands. The system leverages the OpenAI Agents SDK to provide an intelligent assistant that can add parts, modify designs, and run simulations while explaining concepts to users.

## 🌟 Features

- **3D Rocket Visualization** - Real-time 3D rendering with React Three Fiber
- **AI-Powered Design Assistant** - Natural language interface for rocket design
- **Multi-Fidelity Simulation** - Quick client-side and high-fidelity server-side physics
- **Component Library** - Customizable nose cones, body tubes, fins, and motors
- **Educational Insights** - Real-time feedback on stability, altitude, and performance

## 🏗️ Architecture

The application consists of three main services:

1. **Web Frontend** (Next.js)
   - 3D visualization with React Three Fiber
   - UI components and state management
   - Client-side quick simulations

2. **Agent Service** (Python + OpenAI Agents SDK)
   - Natural language understanding
   - Tool execution for rocket modification
   - Suggestions and educational content

3. **Physics Service** (Python + RocketPy)
   - High-fidelity flight simulations
   - Accurate aerodynamic calculations
   - Detailed performance metrics

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- OpenAI API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/rocketv1.git
   cd rocketv1
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

3. Start the services with Docker Compose:
   ```bash
   docker-compose up
   ```

4. Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

## 💬 Using the AI Assistant

The AI assistant can understand commands like:

- "Add a 30cm ogive nose cone"
- "Make the body tube longer"
- "Add four fins with 8cm root and 6cm span"
- "Paint the nose cone red"
- "Run a quick simulation"
- "Run a high-fidelity simulation"
- "Why is my rocket unstable?"

## 🛠️ Development

### Project Structure

```
rocketv1/
├── app/               # Next.js app directory
│   ├── api/           # API routes
│   ├── page.tsx       # Main page
├── components/        # React components
├── lib/               # Utilities and hooks
│   ├── store.ts       # Zustand store
│   ├── ai/            # AI integration
├── services/          # Microservices
│   ├── agentpy/       # OpenAI Agent service
│   ├── rocketpy/      # Physics simulation service
├── types/             # TypeScript type definitions
```

### Running Locally (Without Docker)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the Next.js development server:
   ```bash
   npm run dev
   ```

3. In separate terminals, start the Python services:
   ```bash
   cd services/agentpy
   pip install -r requirements.txt
   python app.py
   
   cd services/rocketpy
   pip install -r requirements.txt
   python app.py
   ```

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [OpenAI](https://openai.com/) for the Agents SDK
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber) for 3D rendering
- [RocketPy](https://github.com/RocketPy-Team/RocketPy) for flight simulations
- [Next.js](https://nextjs.org/) for the web framework 