import { Check, CheckCircle2, DollarSign } from 'lucide-react';
import React from 'react';
import { HourlyPlanEntry, HourInput } from '../types.ts';

interface HourlyTableProps {
  hours: HourInput[];
  plan: HourlyPlanEntry[];
}

export const HourlyTable: React.FC<HourlyTableProps> = ({ hours, plan }) => {
  if (!plan || plan.length !== 24) return null;

  return (
    <div id="hourly-dispatch-table-container" className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6 shadow-xs">
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
            24-Hour Dispatch Plan Schedule
          </h3>
          <p className="text-xs text-slate-500">
            Exact mathematical LP output satisfying all physical energy balances and operator constraints
          </p>
        </div>
        <div className="text-xs text-slate-500 font-medium bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 self-start sm:self-auto">
          Energy Balance: Grid + Solar + Dis = Demand + Chg (±0.01 kWh)
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Hour</th>
              <th className="py-2.5 px-3 text-right">Demand (kWh)</th>
              <th className="py-2.5 px-3 text-right">Solar Avail</th>
              <th className="py-2.5 px-3 text-right">Solar Used</th>
              <th className="py-2.5 px-3 text-right">Tariff (BDT)</th>
              <th className="py-2.5 px-3 text-right">Grid Import</th>
              <th className="py-2.5 px-3 text-center">Battery Action</th>
              <th className="py-2.5 px-3 text-right">Battery Flow</th>
              <th className="py-2.5 px-3 text-right">Battery Energy</th>
              <th className="py-2.5 px-3 text-right">Cost (BDT)</th>
              <th className="py-2.5 px-2 text-center">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
            {plan.map((p) => {
              const h = hours[p.hour];
              const cost = Math.round(p.grid_kwh * h.tariff_bdt_per_kwh * 100) / 100;
              const dis = p.battery_action === 'discharge' ? p.battery_kwh : 0;
              const chg = p.battery_action === 'charge' ? p.battery_kwh : 0;
              const balanced = Math.abs(p.grid_kwh + p.solar_used_kwh + dis - (h.demand_kwh + chg)) < 0.02;

              let actionBadge = (
                <span className="px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-slate-100 text-slate-600">
                  Idle
                </span>
              );
              if (p.battery_action === 'charge') {
                actionBadge = (
                  <span className="px-2 py-0.5 rounded text-[11px] font-sans font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    Charge +{p.battery_kwh}
                  </span>
                );
              } else if (p.battery_action === 'discharge') {
                actionBadge = (
                  <span className="px-2 py-0.5 rounded text-[11px] font-sans font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                    Discharge -{p.battery_kwh}
                  </span>
                );
              }

              return (
                <tr
                  key={p.hour}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    h.tariff_bdt_per_kwh >= 20 ? 'bg-rose-50/20' : h.tariff_bdt_per_kwh <= 6 ? 'bg-emerald-50/20' : ''
                  }`}
                >
                  <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                    {String(p.hour).padStart(2, '0')}:00
                  </td>
                  <td className="py-2 px-3 text-right">{h.demand_kwh}</td>
                  <td className="py-2 px-3 text-right text-slate-500">{h.solar_kwh}</td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-700">
                    {p.solar_used_kwh}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span
                      className={`font-semibold ${
                        h.tariff_bdt_per_kwh >= 20
                          ? 'text-rose-600 font-bold'
                          : h.tariff_bdt_per_kwh <= 6
                          ? 'text-emerald-600'
                          : 'text-slate-700'
                      }`}
                    >
                      {h.tariff_bdt_per_kwh}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-blue-700">
                    {p.grid_kwh}
                  </td>
                  <td className="py-2 px-3 text-center">{actionBadge}</td>
                  <td className="py-2 px-3 text-right">
                    {p.battery_kwh > 0 ? `${p.battery_kwh} kWh` : '—'}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-indigo-700">
                    {p.battery_energy_after_kwh} kWh
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900">
                    ৳{cost.toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-center">
                    {balanced ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 mx-auto" />
                    ) : (
                      <span className="text-rose-600 font-bold">!</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
