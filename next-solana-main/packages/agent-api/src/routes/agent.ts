import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

// Rate limiters
const agentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

const taskLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 50,
});

// Validation schemas
const registerAgentSchema = z.object({
  body: z.object({
    personaId: z.string().min(1),
  })
});

const assignTaskSchema = z.object({
  body: z.object({
    type: z.enum(["trading", "analysis", "social_post", "market_monitor", "education", "engagement"]),
    description: z.string().min(1),
    priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    parameters: z.record(z.any()).optional(),
    deadline: z.string().datetime().optional(),
  })
});

const agentIdParam = z.object({
  params: z.object({
    id: z.string(),
  })
});

// Types (import from core types instead)
interface AgentTaskCreation {
  type: string;
  description: string;
  priority: string;
  parameters?: Record<string, unknown>;
  deadline?: string;
}

interface CoordinationResult {
  success: boolean;
  agentId: string;
  taskId: string;
  result?: Record<string, unknown>;
  error?: string;
}

export default (coordinationService: any) => {
  const router = Router();

  router.use(agentLimiter);

  // POST /agents/register - Register new agent
  router.post("/register", requireAuth, validate(registerAgentSchema), async (req, res) => {
    try {
      const { personaId } = req.body;

      const result = await coordinationService.registerAgent(personaId);

      if (result.success) {
        res.status(201).json({
          agentId: result.agentId,
          message: "Agent registered successfully"
        });
      } else {
        res.status(400).json({ error: "Failed to register agent" });
      }
    } catch (error) {
      console.error("Error registering agent:", error);
      res.status(500).json({ error: "Failed to register agent" });
    }
  });

  // POST /agents/:id/tasks - Assign task to agent
  router.post("/:id/tasks", requireAuth, taskLimiter, validate(assignTaskSchema), async (req, res) => {
    try {
      const { id } = req.params;
      const taskData: AgentTaskCreation = req.body;

      const task = {
        type: taskData.type as any,
        description: taskData.description,
        priority: taskData.priority as any,
        parameters: taskData.parameters,
        deadline: taskData.deadline ? new Date(taskData.deadline) : undefined,
      };

      const result: CoordinationResult = await coordinationService.assignTask(task);

      if (result.success) {
        res.status(201).json({
          taskId: result.taskId,
          agentId: result.agentId,
          message: "Task assigned successfully"
        });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error("Error assigning task:", error);
      res.status(500).json({ error: "Failed to assign task" });
    }
  });

  // GET /agents/status - Get all agent statuses
  router.get("/status", requireAuth, (req, res) => {
    try {
      const statuses = coordinationService.getAgentStatuses();
      res.json({ agents: statuses });
    } catch (error) {
      console.error("Error getting agent statuses:", error);
      res.status(500).json({ error: "Failed to get agent statuses" });
    }
  });

  // GET /agents/tasks - Get active tasks
  router.get("/tasks", requireAuth, (req, res) => {
    try {
      const tasks = coordinationService.getActiveTasks();
      res.json({ tasks });
    } catch (error) {
      console.error("Error getting active tasks:", error);
      res.status(500).json({ error: "Failed to get active tasks" });
    }
  });

  return router;
};
