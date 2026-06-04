import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { medSearchSchema } from '../lib/validation';
import { searchCatalog } from '../services/catalog';

export const medicamentosRouter = Router();

// GET /api/medicamentos/busca?q=&limit=
// Typo-tolerant fuzzy search over the real-medicine catalog (read-only reference).
medicamentosRouter.get(
  '/busca',
  asyncHandler(async (req, res) => {
    const { q, limit } = medSearchSchema.parse(req.query);
    const results = searchCatalog(q, limit);
    res.json({ results, total: results.length });
  }),
);
