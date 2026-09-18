import { Activity, BatteryCharging, CheckCircle, DollarSign, ShieldAlert, Zap } from 'lucide-react';
import React from 'react';
import { OptimizeEnergyResponse, ReplayVerificationResult } from '../types.ts';

interface KpiCardsProps {
  result: OptimizeEnergyResponse | null;
  baselineCost: number;
  verification: ReplayVerificationResult | null;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  result,
  baselineCost,
  verification,
}) => {
  if (!result) return null;

  const costSavings = baselineCost > 0 ? baselineCost - result.total_cost_bdt : 0;
  const savingsPct = baselineCost > 0 ? (costSavings / baselineCost) * 100 : 0;

  const initialBattery = result.hourly_plan[0]?.battery_energy_after_kwh !== undefined
    ? (result.hourly_plan[0].battery_action === 'charge'
        ? result.hourly_plan[0].battery_energy_after_kwh - result.hourly_plan[0].battery_kwh
        : result.hourly_plan[0].battery_action === 'discharge'
        ? result.hourly_plan[0].battery_energy_after_kwh + result.hourly_plan[0].battery_kwh
        : result.hourly_plan[0].battery_energy_after_kwh)
    : 0;

  const finalBattery = result.hourly_plan[23]?.battery_energy_after_kwh ?? 0;
  const isNeutral = Math.abs(finalBattery - initialBattery) < 0.05;

  return (
    <div id="kpi-metrics-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Total Cost Card */}
      <div id="card-total-cost" className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Grid Cost
          </span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900">
            ৳ {result.total_cost_bdt.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-medium">BDT</span>
        </div>
        <div className="mt-2 flex items-center text-xs">
          {costSavings > 0 ? (
            <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md">
              Saved ৳ {Math.round(costSavings).toLocaleString()} ({savingsPct.toFixed(1)}%) vs unbuffered
            </span>
          ) : (
            <span className="text-slate-500">Optimal schedule cost</span>
          )}
        </div>
      </div>

      {/* 2. Total Grid Energy Card */}
      <div id="card-total-grid" className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Grid Import
          </span>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900">
            {result.total_grid_kwh.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-medium">kWh</span>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Over 24-hour dispatch horizon
        </div>
      </div>

      {/* 3. Peak Grid Demand Card */}
      <div id="card-peak-grid" className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Peak Grid Import
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900">
            {result.peak_grid_kwh.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-medium">kWh / hr</span>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Maximum hourly substation draw
        </div>
      </div>

      {/* 4. Battery Neutrality & Verification Status */}
      <div id="card-neutrality-status" className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Neutrality & Verification
          </span>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            verification?.valid !== false ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}>
            <BatteryCharging className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="text-lg font-bold text-slate-900">
            {initialBattery} → {finalBattery} kWh
          </span>
          <span className="text-xs text-emerald-600 font-medium">
            {isNeutral ? '(100% Balanced)' : '(Imbalanced)'}
          </span>
        </div>
        <div className="mt-2 flex items-center text-xs">
          {verification && verification.valid ? (
            <span className="inline-flex items-center text-emerald-700 font-medium">
              <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              Replay Verified: 0 Violations
            </span>
          ) : verification && !verification.valid ? (
            <span className="inline-flex items-center text-rose-700 font-medium">
              <ShieldAlert className="w-3.5 h-3.5 mr-1 text-rose-600" />
              {verification.violations.length} Rule Violations
            </span>
          ) : (
            <span className="text-slate-500">Consistent with specs</span>
          )}
        </div>
      </div>
    </div>
  );
};
