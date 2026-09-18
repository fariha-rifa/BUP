import { Battery, Flame, Sun, TrendingUp, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { BatterySpec, HourlyPlanEntry, HourInput } from '../types.ts';

interface ScheduleChartProps {
  hours: HourInput[];
  plan: HourlyPlanEntry[];
  battery: BatterySpec;
}

export const ScheduleChart: React.FC<ScheduleChartProps> = ({
  hours,
  plan,
  battery,
}) => {
  const [activeHour, setActiveHour] = useState<number | null>(null);

  if (!plan || plan.length !== 24) return null;

  // Max value for scaling
  const maxDemandOrGrid = Math.max(
    ...hours.map((h) => h.demand_kwh),
    ...plan.map((p) => p.grid_kwh),
    ...hours.map((h) => h.solar_kwh)
  );

  const chartHeight = 220;
  const chartWidth = 780;
  const colWidth = chartWidth / 24;

  // SoC points
  const socPoints = plan.map((p, idx) => {
    const x = (idx + 0.5) * colWidth;
    const y = chartHeight - (p.battery_energy_after_kwh / battery.capacity_kwh) * (chartHeight - 40) - 20;
    return `${x},${y}`;
  }).join(' ');

  const minReserveY = chartHeight - (battery.minimum_energy_kwh / battery.capacity_kwh) * (chartHeight - 40) - 20;

  return (
    <div id="schedule-chart-container" className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
            24-Hour Energy Dispatch & Battery Trajectory
          </h3>
          <p className="text-xs text-slate-500">
            Visualizing Grid Import, Solar Self-Consumption, Battery State of Charge & Dynamic Tariff
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-xs flex-wrap">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-xs bg-emerald-500"></span>
            <span className="text-slate-600">Solar Used</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-xs bg-blue-500"></span>
            <span className="text-slate-600">Grid Import</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-xs bg-amber-400"></span>
            <span className="text-slate-600">Battery Chg</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-xs bg-purple-500"></span>
            <span className="text-slate-600">Battery Dis</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-0.5 bg-indigo-600"></span>
            <span className="text-slate-600 font-medium">Battery SoC</span>
          </div>
        </div>
      </div>

      {/* Main SVG Chart */}
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-56 bg-slate-50/50 rounded-lg overflow-visible"
          >
            {/* Grid horizontal lines */}
            {[0.25, 0.5, 0.75, 1.0].map((ratio, i) => (
              <line
                key={i}
                x1="0"
                y1={chartHeight - ratio * (chartHeight - 40) - 20}
                x2={chartWidth}
                y2={chartHeight - ratio * (chartHeight - 40) - 20}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
            ))}

            {/* Minimum battery reserve floor line */}
            <line
              x1="0"
              y1={minReserveY}
              x2={chartWidth}
              y2={minReserveY}
              stroke="#cbd5e1"
              strokeDasharray="2 2"
            />
            <text x="6" y={minReserveY - 4} fontSize="9" fill="#94a3b8" fontWeight="600">
              Base Min Reserve ({battery.minimum_energy_kwh} kWh)
            </text>

            {/* Hourly Columns */}
            {plan.map((p, idx) => {
              const hInput = hours[idx];
              const x = idx * colWidth;
              const barW = colWidth - 8;
              const xOffset = x + 4;

              const solarH = (p.solar_used_kwh / maxDemandOrGrid) * (chartHeight - 40);
              const gridH = (p.grid_kwh / maxDemandOrGrid) * (chartHeight - 40);

              const isHovered = activeHour === idx;

              return (
                <g
                  key={idx}
                  onMouseEnter={() => setActiveHour(idx)}
                  onMouseLeave={() => setActiveHour(null)}
                  className="cursor-pointer"
                >
                  {/* Background highlight on hover */}
                  {isHovered && (
                    <rect
                      x={x}
                      y="0"
                      width={colWidth}
                      height={chartHeight}
                      fill="#e0f2fe"
                      opacity="0.4"
                    />
                  )}

                  {/* Solar bar */}
                  <rect
                    x={xOffset}
                    y={chartHeight - 20 - solarH}
                    width={barW / 2}
                    height={solarH}
                    fill="#10b981"
                    rx="1.5"
                  />

                  {/* Grid bar */}
                  <rect
                    x={xOffset + barW / 2}
                    y={chartHeight - 20 - gridH}
                    width={barW / 2}
                    height={gridH}
                    fill="#3b82f6"
                    rx="1.5"
                  />

                  {/* Battery action marker */}
                  {p.battery_action === 'charge' && (
                    <circle
                      cx={x + colWidth / 2}
                      cy={chartHeight - 20 - 4}
                      r="3"
                      fill="#f59e0b"
                    />
                  )}
                  {p.battery_action === 'discharge' && (
                    <circle
                      cx={x + colWidth / 2}
                      cy={chartHeight - 20 - 4}
                      r="3"
                      fill="#a855f7"
                    />
                  )}

                  {/* Hour label */}
                  <text
                    x={x + colWidth / 2}
                    y={chartHeight - 4}
                    textAnchor="middle"
                    fontSize="9"
                    fill={isHovered ? '#0f172a' : '#64748b'}
                    fontWeight={isHovered ? 'bold' : 'normal'}
                  >
                    {idx}h
                  </text>
                </g>
              );
            })}

            {/* Battery SoC Curve */}
            <polyline
              fill="none"
              stroke="#6366f1"
              strokeWidth="2.5"
              points={socPoints}
              strokeLinejoin="round"
            />

            {/* SoC node dots */}
            {plan.map((p, idx) => {
              const cx = (idx + 0.5) * colWidth;
              const cy =
                chartHeight - (p.battery_energy_after_kwh / battery.capacity_kwh) * (chartHeight - 40) - 20;
              const isHovered = activeHour === idx;

              return (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5 : 2.5}
                  fill={isHovered ? '#4338ca' : '#6366f1'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Hourly Detail Inspector Card when an hour is hovered or selected */}
      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        {activeHour !== null ? (
          <div className="flex items-center justify-between flex-wrap gap-3 text-xs">
            <div className="font-bold text-slate-900 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span>Hour {activeHour}:00 - {(activeHour + 1) % 24}:00</span>
            </div>
            <div className="flex items-center space-x-4 flex-wrap">
              <div>
                <span className="text-slate-500">Demand: </span>
                <span className="font-bold text-slate-800">{hours[activeHour].demand_kwh} kWh</span>
              </div>
              <div>
                <span className="text-slate-500">Solar Used: </span>
                <span className="font-bold text-emerald-700">{plan[activeHour].solar_used_kwh} kWh</span>
              </div>
              <div>
                <span className="text-slate-500">Grid Import: </span>
                <span className="font-bold text-blue-700">{plan[activeHour].grid_kwh} kWh</span>
              </div>
              <div>
                <span className="text-slate-500">Tariff: </span>
                <span className="font-bold text-slate-800">৳{hours[activeHour].tariff_bdt_per_kwh} BDT</span>
              </div>
              <div>
                <span className="text-slate-500">Battery: </span>
                <span className="font-bold text-indigo-700 capitalize">
                  {plan[activeHour].battery_action} ({plan[activeHour].battery_kwh} kWh) → SoC {plan[activeHour].battery_energy_after_kwh} kWh
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 text-center">
            Hover over any hour column on the chart to inspect granular dispatch, battery flow, and tariff data.
          </div>
        )}
      </div>
    </div>
  );
};
