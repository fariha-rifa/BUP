import { AlertCircle, CheckCircle2, Cpu, Database, Zap } from 'lucide-react';
import React from 'react';

interface HeaderProps {
  isBackendHealthy: boolean;
  isOptimizing: boolean;
  onRunOptimization: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isBackendHealthy,
  isOptimizing,
  onRunOptimization,
}) => {
  return (
    <header id="app-header" className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm ring-4 ring-emerald-50">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">GridWise Energy Optimizer</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                v1.0 Production
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Campus Microgrid Scheduling • Directive Interpretation • 24h LP Solver
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 flex-wrap">
          {/* Health Badge */}
          <div
            id="backend-status-badge"
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isBackendHealthy
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {isBackendHealthy ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Backend: HTTP 200</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Backend: Connecting...</span>
              </>
            )}
          </div>

          {/* Engine Badges */}
          <div className="hidden md:flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <Cpu className="w-3.5 h-3.5 text-indigo-600 mr-1" />
            <span>2-Phase Simplex LP</span>
          </div>

          {/* Optimize Button */}
          <button
            id="btn-run-optimization"
            onClick={onRunOptimization}
            disabled={isOptimizing}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-sm font-medium transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Zap className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
            <span>{isOptimizing ? 'Optimizing...' : 'Run Optimization'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
