import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import influencerRoutes from '../routes/influencer';
import agentRoutes from '../routes/agent';
import { AgentCoordinationService } from '../AgentCoordinationService';

const app = express();
const httpServer = createServer(app);

// WebSocket server setup for real-time updates
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Agent coordination service setup
const coordinationService = new AgentCoordinationService();

// Middleware
app.use(cors());
app.use(express.json());

// WebSocket event publisher
const publishWsEvent = (event: string, payload: unknown) => {
  io.emit(event, payload);
};

// Routes
app.use('/api/agents', agentRoutes(coordinationService));
app.use('/api/influencers', influencerRoutes(publishWsEvent));

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Subscribe to real-time updates for agents and tasks
  coordinationService.on('agent_registered', (data) => {
    socket.emit('agent:registered', data);
  });

  coordinationService.on('task_assigned', (data) => {
    socket.emit('task:assigned', data);
  });

  coordinationService.on('task_completed', (data) => {
    socket.emit('task:completed', data);
  });

  coordinationService.on('task_failed', (data) => {
    socket.emit('task:failed', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, () => {
  console.log(`Agent API server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  coordinationService.shutdown();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  coordinationService.shutdown();
});
