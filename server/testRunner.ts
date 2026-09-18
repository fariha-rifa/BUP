import { SAMPLE_CASES } from './sampleCases.ts';
import { fallbackSemanticInterpret } from './llmInterpreter.ts';
import { optimizeSchedule } from './optimizer.ts';
import { verifyPlan } from './validator.ts';

console.log('--- RUNNING GRIDWISE SOLVER TEST ON ALL 10 SAMPLE CASES ---');

let allPassed = true;

for (const sample of SAMPLE_CASES) {
  const { input, expected_output } = sample;
  const interp = fallbackSemanticInterpret(input.operator_notes, input.battery);
  const result = optimizeSchedule(input.scenario_id, input.hours, input.battery, interp);
  const verification = verifyPlan(
    input.hours,
    input.battery,
    interp,
    result.hourly_plan,
    result.total_grid_kwh,
    result.total_cost_bdt,
    result.peak_grid_kwh
  );

  const costMatch = expected_output ? Math.abs(result.total_cost_bdt - expected_output.total_cost_bdt) < 0.05 : true;
  const gridMatch = expected_output ? Math.abs(result.total_grid_kwh - expected_output.total_grid_kwh) < 0.05 : true;

  console.log(`\nCase [${sample.id}]: ${sample.label}`);
  console.log(`  Valid: ${verification.valid ? 'PASS' : 'FAIL'}`);
  console.log(`  Calculated Cost: ${result.total_cost_bdt} BDT (Expected: ${expected_output?.total_cost_bdt} BDT) -> ${costMatch ? 'MATCH' : 'DIFF'}`);
  console.log(`  Calculated Grid: ${result.total_grid_kwh} kWh (Expected: ${expected_output?.total_grid_kwh} kWh) -> ${gridMatch ? 'MATCH' : 'DIFF'}`);
  console.log(`  Peak Grid: ${result.peak_grid_kwh} kWh (Expected: ${expected_output?.peak_grid_kwh} kWh)`);

  if (!verification.valid) {
    console.error(`  Violations:`, verification.violations);
    allPassed = false;
  }
}

console.log(`\nOVERALL TEST RESULT: ${allPassed ? 'ALL CASES PASSED PERFECTLY!' : 'SOME CASES FAILED'}`);
