import { Battery, Sliders, Sun, Zap } from 'lucide-react';
import React from 'react';
import { BatterySpec, HourInput } from '../types.ts';

interface CustomEditorProps {
  battery: BatterySpec;
  hours: HourInput[];
  onUpdateBattery: (battery: BatterySpec) => void;
  onUpdateHours: (hours: HourInput[]) => void;
}

export const CustomEditor: React.FC<CustomEditorProps> = ({
  battery,
  hours,
  onUpdateBattery,
  onUpdateHours,
}) => {
  const handleBatteryChange = (field: keyof BatterySpec, val: number) => {
    onUpdateBattery({
      ...battery,
      [field]: Math.max(0, val),
    });
  };

  const applyPreset = (type: 'summer_peak' | 'cloudy' | 'high_tariff') => {
    const next = hours.map((h) => {
      let solar = h.solar_kwh;
      let demand = h.demand_kwh;
      let tariff = h.tariff_bdt_per_kwh;

      if (type === 'summer_peak') {
        demand = Math.round(h.demand_kwh * 1.2);
      } else if (type === 'cloudy') {
        solar = Math.round(h.solar_kwh * 0.3);
      } else if (type === 'high_tariff') {
        if (h.hour >= 18 && h.hour <= 21) tariff = 35;
      }
      return { ...h, solar_kwh: solar, demand_kwh: demand, tariff_bdt_per_kwh: tariff };
    });
    onUpdateHours(next);
  };

  return (
    <div id="custom-parameter-editor" className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
            Microgrid Battery & Tariff Configuration
          </h3>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500 font-medium">Quick Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset('summer_peak')}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer font-medium"
          >
            +20% Demand
          </button>
          <button
            type="button"
            onClick={() => applyPreset('cloudy')}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer font-medium"
          >
            Cloud Cover (30% Solar)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('high_tariff')}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer font-medium"
          >
            Evening Surge Tariff
          </button>
        </div>
      </div>

      {/* Battery Parameters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        <div>
          <label className="block text-slate-500 font-medium mb-1">Capacity (kWh)</label>
          <input
            type="number"
            value={battery.capacity_kwh}
            onChange={(e) => handleBatteryChange('capacity_kwh', parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:outline-emerald-500"
          />
        </div>
        <div>
          <label className="block text-slate-500 font-medium mb-1">Initial Energy (kWh)</label>
          <input
            type="number"
            value={battery.initial_energy_kwh}
            onChange={(e) => handleBatteryChange('initial_energy_kwh', parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:outline-emerald-500"
          />
        </div>
        <div>
          <label className="block text-slate-500 font-medium mb-1">Min Reserve (kWh)</label>
          <input
            type="number"
            value={battery.minimum_energy_kwh}
            onChange={(e) => handleBatteryChange('minimum_energy_kwh', parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:outline-emerald-500"
          />
        </div>
        <div>
          <label className="block text-slate-500 font-medium mb-1">Max Charge (kWh/h)</label>
          <input
            type="number"
            value={battery.max_charge_kwh_per_hour}
            onChange={(e) => handleBatteryChange('max_charge_kwh_per_hour', parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:outline-emerald-500"
          />
        </div>
        <div>
          <label className="block text-slate-500 font-medium mb-1">Max Discharge (kWh/h)</label>
          <input
            type="number"
            value={battery.max_discharge_kwh_per_hour}
            onChange={(e) => handleBatteryChange('max_discharge_kwh_per_hour', parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:outline-emerald-500"
          />
        </div>
      </div>
    </div>
  );
};
