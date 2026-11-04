import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/protect.js';
import { requireWorkspaceRole } from '../middleware/workspaceRole.js';
import { createPlan, breakdownTask, summarizeProject, answerProjectQuestion } from '../services/ai/ai.service.js';

const router = Router();
router.use(protect, requireWorkspaceRole(), rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false }));
router.post('/plan', async (req, res) => res.json({ success: true, data: { plan: await createPlan(req.body.idea) } }));
router.post('/breakdown', async (req, res) => res.json({ success: true, data: await breakdownTask(req.body.task) }));
router.post('/summarize', async (req, res) => res.json({ success: true, data: { summary: await summarizeProject(req.body.projectId, req.workspaceId) } }));
router.post('/ask', async (req, res) => res.json({ success: true, data: { answer: await answerProjectQuestion(req.body.projectId, req.workspaceId, req.body.question) } }));
export default router;
