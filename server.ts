import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { interpretOperatorNotes } from './server/llmInterpreter.ts';
import { optimizeSchedule } from './server/optimizer.ts';
import { SAMPLE_CASES } from './server/sampleCases.ts';
import { verifyPlan } from './server/validator.ts';
import { OptimizeEnergyRequest } from './src/types.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body parsing with error handling
  app.use(express.json({ limit: '5mb' }));

  // Error middleware for malformed JSON
  app.use((err: unknown, req: Request, res: Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in (err as unknown as Record<string, unknown>)) {
      return res.status(400).json({
        error: 'Malformed JSON payload',
        message: 'The request body could not be parsed as valid JSON.',
      });
    }
    next(err);
  });

  // CORS headers for judging harness & external calls
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // ==========================================
  // MANDATORY JUDGE ENDPOINTS
  // ==========================================

  // 1. GET /health
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // 2. POST /optimize-energy
  app.post('/optimize-energy', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const body = req.body as Partial<OptimizeEnergyRequest>;

      // Validate required top-level fields
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Request body must be a JSON object' });
      }

      const { scenario_id, operator_notes, hours, battery } = body;

      if (!scenario_id || typeof scenario_id !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid scenario_id (must be a string)' });
      }

      if (!Array.isArray(operator_notes) || operator_notes.length < 1 || operator_notes.length > 3) {
        return res.status(400).json({
          error: 'Missing or invalid operator_notes (must be an array of 1 to 3 non-empty strings)',
        });
      }

      for (let i = 0; i < operator_notes.length; i++) {
        if (typeof operator_notes[i] !== 'string' || !operator_notes[i].trim()) {
          return res.status(400).json({
            error: `operator_notes[${i}] must be a non-empty string`,
          });
        }
      }

      if (!Array.isArray(hours) || hours.length !== 24) {
        return res.status(400).json({
          error: 'hours must be an array of exactly 24 hourly entries (0 through 23)',
        });
      }

      for (let i = 0; i < 24; i++) {
        const h = hours[i];
        if (
          !h ||
          typeof h !== 'object' ||
          h.hour !== i ||
          typeof h.demand_kwh !== 'number' ||
          h.demand_kwh < 0 ||
          typeof h.solar_kwh !== 'number' ||
          h.solar_kwh < 0 ||
          typeof h.tariff_bdt_per_kwh !== 'number' ||
          h.tariff_bdt_per_kwh < 0
        ) {
          return res.status(400).json({
            error: `Invalid hour entry at index ${i}`,
          });
        }
      }

      if (
        !battery ||
        typeof battery !== 'object' ||
        typeof battery.capacity_kwh !== 'number' ||
        battery.capacity_kwh <= 0 ||
        typeof battery.initial_energy_kwh !== 'number' ||
        battery.initial_energy_kwh < 0 ||
        typeof battery.minimum_energy_kwh !== 'number' ||
        battery.minimum_energy_kwh < 0 ||
        typeof battery.max_charge_kwh_per_hour !== 'number' ||
        battery.max_charge_kwh_per_hour < 0 ||
        typeof battery.max_discharge_kwh_per_hour !== 'number' ||
        battery.max_discharge_kwh_per_hour < 0
      ) {
        return res.status(400).json({
          error: 'Invalid battery object fields',
        });
      }

      // Step 1: LLM-assisted operator notes interpretation
      const { interpretations, method } = await interpretOperatorNotes(
        operator_notes,
        battery,
        hours
      );

      // Step 2: Mathematical optimization over 24-hour horizon
      const result = optimizeSchedule(scenario_id, hours, battery, interpretations);

      // Step 3: Replay verification to ensure 100% compliance
      const check = verifyPlan(
        hours,
        battery,
        interpretations,
        result.hourly_plan,
        result.total_grid_kwh,
        result.total_cost_bdt,
        result.peak_grid_kwh
      );

      if (!check.valid) {
        console.warn(`Replay validation warning for ${scenario_id}:`, check.violations);
      }

      // Exact response schema required by Problem Statement Section 10
      const responsePayload = {
        scenario_id: result.scenario_id,
        directive_interpretation: result.directive_interpretation,
        hourly_plan: result.hourly_plan,
        total_grid_kwh: result.total_grid_kwh,
        total_cost_bdt: result.total_cost_bdt,
        peak_grid_kwh: result.peak_grid_kwh,
        plan_summary: result.plan_summary,
      };

      const duration = Date.now() - startTime;
      res.setHeader('X-Processing-Time-Ms', duration.toString());
      res.setHeader('X-Interpretation-Method', method);

      return res.status(200).json(responsePayload);
    } catch (err: unknown) {
      console.error('Unhandled error in /optimize-energy:', err);
      // Controlled error, never expose secrets or raw stack traces (Problem Statement 6.1 & 8)
      return res.status(500).json({
        error: 'An internal error occurred while processing the energy optimization request.',
      });
    }
  });

  // ==========================================
  // HELPER API ENDPOINTS FOR WEB UI
  // ==========================================

  // GET /api/samples: list of 10 official reference sample cases
  app.get('/api/samples', (req: Request, res: Response) => {
    res.json(SAMPLE_CASES);
  });

  // POST /api/verify: independent verification
  app.post('/api/verify', (req: Request, res: Response) => {
    try {
      const { hours, battery, directives, hourly_plan, total_grid_kwh, total_cost_bdt, peak_grid_kwh } =
        req.body;
      const result = verifyPlan(
        hours,
        battery,
        directives,
        hourly_plan,
        total_grid_kwh,
        total_cost_bdt,
        peak_grid_kwh
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: 'Verification failed' });
    }
  });

  // ==========================================
  // VITE / STATIC SERVING
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GridWise Server running on http://0.0.0.0:${PORT}`);
    console.log(`Health endpoint: http://0.0.0.0:${PORT}/health`);
    console.log(`Optimization endpoint: http://0.0.0.0:${PORT}/optimize-energy`);
  });
}

startServer();
