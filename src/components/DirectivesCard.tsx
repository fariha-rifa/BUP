import { AlertTriangle, Battery, Clock, Plus, Sun, Trash2, XCircle, Zap } from 'lucide-react';
import React from 'react';
import { DirectiveInterpretation, DirectiveType } from '../types.ts';

interface DirectivesCardProps {
  notes: string[];
  interpretations: DirectiveInterpretation[] | null;
  isCustomMode: boolean;
  onUpdateNotes?: (notes: string[]) => void;
  planSummary?: string;
}

export const DirectivesCard: React.FC<DirectivesCardProps> = ({
  notes,
  interpretations,
  isCustomMode,
  onUpdateNotes,
  planSummary,
}) => {
  const getBadgeStyle = (type: DirectiveType) => {
    switch (type) {
      case 'solar_reduction':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'minimum_battery_reserve':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'no_charge_window':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'no_discharge_window':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'max_grid_window':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'no_op':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getIcon = (type: DirectiveType) => {
    switch (type) {
      case 'solar_reduction':
        return <Sun className="w-3.5 h-3.5 text-amber-600 mr-1" />;
      case 'minimum_battery_reserve':
        return <Battery className="w-3.5 h-3.5 text-purple-600 mr-1" />;
      case 'no_charge_window':
        return <XCircle className="w-3.5 h-3.5 text-rose-600 mr-1" />;
      case 'no_discharge_window':
        return <AlertTriangle className="w-3.5 h-3.5 text-blue-600 mr-1" />;
      case 'max_grid_window':
        return <Zap className="w-3.5 h-3.5 text-indigo-600 mr-1" />;
      case 'no_op':
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400 mr-1" />;
    }
  };

  const handleNoteChange = (index: number, val: string) => {
    if (!onUpdateNotes) return;
    const next = [...notes];
    next[index] = val;
    onUpdateNotes(next);
  };

  const handleAddNote = () => {
    if (!onUpdateNotes || notes.length >= 3) return;
    onUpdateNotes([...notes, 'New operator note...']);
  };

  const handleRemoveNote = (index: number) => {
    if (!onUpdateNotes || notes.length <= 1) return;
    onUpdateNotes(notes.filter((_, i) => i !== index));
  };

  return (
    <div id="directives-card" className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
            Operator Directives & LLM Interpretation
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
            {notes.length} Note{notes.length > 1 ? 's' : ''}
          </span>
        </div>
        {isCustomMode && notes.length < 3 && (
          <button
            id="btn-add-note"
            type="button"
            onClick={handleAddNote}
            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Note</span>
          </button>
        )}
      </div>

      {planSummary && (
        <div className="mb-4 p-3 bg-emerald-50/70 border border-emerald-100 rounded-lg text-xs text-emerald-900 leading-relaxed">
          <strong className="font-semibold text-emerald-950">Optimization Plan Summary: </strong>
          {planSummary}
        </div>
      )}

      <div className="space-y-3">
        {notes.map((note, index) => {
          const interp = interpretations?.find((d) => d.note_index === index);

          return (
            <div
              key={index}
              id={`directive-row-${index}`}
              className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                {/* Note Content */}
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1.5">
                    <span className="text-xs font-bold text-slate-700">Note {index + 1}:</span>
                    {interp && (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyle(
                          interp.directive_type
                        )}`}
                      >
                        {getIcon(interp.directive_type)}
                        {interp.directive_type}
                      </span>
                    )}
                    {interp && !interp.applies && (
                      <span className="text-[11px] font-medium text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full">
                        Non-Dispatch Distractor
                      </span>
                    )}
                  </div>

                  {isCustomMode ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => handleNoteChange(index, e.target.value)}
                        className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:outline-emerald-500"
                        placeholder="Enter natural language operator note..."
                      />
                      {notes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveNote(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove note"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-700 italic">"{note}"</p>
                  )}

                  {/* Interp Explanation */}
                  {interp?.explanation && (
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      <span className="font-medium text-slate-600">Guardrail Analysis:</span>{' '}
                      {interp.explanation}
                    </p>
                  )}
                </div>

                {/* Structured Adjustment Details */}
                {interp?.structured_adjustment && (
                  <div className="shrink-0 bg-white border border-slate-200 rounded-lg p-2 text-xs space-y-1 min-w-44">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Applied Constraints
                    </div>
                    {interp.structured_adjustment.hours && (
                      <div className="flex items-center space-x-1 flex-wrap">
                        <span className="text-[11px] text-slate-500">Hours:</span>
                        <span className="font-mono text-xs font-semibold text-slate-800">
                          [{interp.structured_adjustment.hours.join(', ')}]
                        </span>
                      </div>
                    )}
                    {'factor' in interp.structured_adjustment && (
                      <div className="flex items-center space-x-1">
                        <span className="text-[11px] text-slate-500">Usable Factor:</span>
                        <span className="font-mono text-xs font-bold text-amber-700">
                          {((interp.structured_adjustment as { factor: number }).factor * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                    {'minimum_energy_kwh' in interp.structured_adjustment && (
                      <div className="flex items-center space-x-1">
                        <span className="text-[11px] text-slate-500">Min Reserve:</span>
                        <span className="font-mono text-xs font-bold text-purple-700">
                          {(interp.structured_adjustment as { minimum_energy_kwh: number }).minimum_energy_kwh} kWh
                        </span>
                      </div>
                    )}
                    {'max_grid_kwh' in interp.structured_adjustment && (
                      <div className="flex items-center space-x-1">
                        <span className="text-[11px] text-slate-500">Max Grid Cap:</span>
                        <span className="font-mono text-xs font-bold text-indigo-700">
                          {(interp.structured_adjustment as { max_grid_kwh: number }).max_grid_kwh} kWh
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
