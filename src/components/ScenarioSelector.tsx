import { Check, ChevronDown, Edit3, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { SampleCase } from '../types.ts';

interface ScenarioSelectorProps {
  samples: SampleCase[];
  selectedSampleId: string;
  onSelectSample: (sample: SampleCase) => void;
  isCustomMode: boolean;
  onToggleCustomMode: () => void;
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  samples,
  selectedSampleId,
  onSelectSample,
  isCustomMode,
  onToggleCustomMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedCase = samples.find((s) => s.id === selectedSampleId);

  return (
    <div id="scenario-selector-container" className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Active Scenario
            </h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {isCustomMode ? 'Custom Parameter Mode' : selectedSampleId}
            </span>
          </div>
          <p className="text-base font-bold text-slate-900 mt-1">
            {isCustomMode ? 'Custom Campus Configuration' : (selectedCase?.label ?? 'Select a Scenario')}
          </p>
          {selectedCase?.description && !isCustomMode && (
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              {selectedCase.description}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-3 flex-wrap">
          {/* Preset Selector Dropdown */}
          <div className="relative">
            <button
              id="btn-scenario-dropdown"
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-between space-x-2 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 cursor-pointer min-w-56"
            >
              <div className="flex items-center space-x-2 truncate">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">{selectedCase?.label ?? 'Choose Scenario'}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {isOpen && (
              <div
                id="scenario-dropdown-menu"
                className="absolute right-0 mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1.5 max-h-96 overflow-y-auto"
              >
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Official Reference Test Cases
                </div>
                {samples.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onSelectSample(s);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                      s.id === selectedSampleId && !isCustomMode ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'text-slate-700'
                    }`}
                  >
                    <div className="pr-2">
                      <div className="font-medium text-slate-900">{s.id}: {s.label}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">{s.description}</div>
                    </div>
                    {s.id === selectedSampleId && !isCustomMode && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom Mode Toggle */}
          <button
            id="btn-toggle-custom"
            type="button"
            onClick={onToggleCustomMode}
            className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
              isCustomMode
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>{isCustomMode ? 'Editing Custom' : 'Custom Input'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
