import express from 'express';
import { getMatriculaSearch } from './matriculaSearch.js';

export function createMatriculaRouter(requireAuth) {
  const router = express.Router();
  router.use(requireAuth);
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/metadata', (_req, res) => {
    try { res.json(getMatriculaSearch().metadata); }
    catch (error) {
      console.error('[MATRICULAS]', error);
      res.status(503).json({ error: 'A base de matrículas está indisponível. Tente novamente mais tarde.' });
    }
  });
  router.get('/', (req, res) => {
    try { res.json(getMatriculaSearch().search(req.query)); }
    catch (error) {
      console.error('[MATRICULAS]', error);
      res.status(503).json({ error: 'Não foi possível consultar as matrículas. Tente novamente.' });
    }
  });
  return router;
}
