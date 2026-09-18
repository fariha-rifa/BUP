import { CheckCircle2, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import React from 'react';
import { ReplayVerificationResult } from '../types.ts';

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  verification: ReplayVerificationResult | null;
}

export const ValidationModal: React.FC<ValidationModalProps> = ({
  isOpen,
  onClose,
  verification,
}) => {
  if (!isOpen || !verification) return null;

  const checks = [
    {
      title: '24-Hour Schedule Integrity',
      desc: 'Contains exactly 24 unique sequential hours (0 through 23)',
      status: verification.violations.every((v) => !v.includes('24 hours') && !v.includes('Hour out of order')),
    },
    {
      title: 'Physical Energy Conservation',
      desc: 'grid_kwh + solar_used_kwh + battery_discharge_kwh === demand_kwh + battery_charge_kwh',
      status: verification.energyBalanceValid,
    },
    {
      title: 'Battery Bounds & Reserve Limits',
      desc: 'Energy stays within [active_reserve, capacity_kwh] and state transitions match battery flows',
      status: verification.batteryBoundsValid,
    },
    {
      title: 'Inverter Charge / Discharge Limits',
      desc: 'Hourly charge and discharge rates obey maximum kW limits; idle has zero flow',
      status: verification.rateLimitsValid,
    },
    {
      title: 'Solar Availability & Degradation',
      desc: 'solar_used_kwh does not exceed available solar (after solar_reduction factor)',
      status: verification.solarUsageValid,
    },
    {
      title: 'End-of-Day Neutrality',
      desc: 'Battery energy after hour 23 equals initial battery energy',
      status: verification.neutralityValid,
    },
    {
      title: 'Directive & Window Compliance',
      desc: 'No charging during no_charge, no discharging during no_discharge, grid below max_grid caps',
      status: verification.directivesValid,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                verification.valid ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}
            >
              {verification.valid ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <ShieldAlert className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                GridWise Replay Consistency Audit
              </h3>
              <p className="text-xs text-slate-500">
                Independent compliance verification of physical equations & operator directives
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overall Status Banner */}
        <div
          className={`mt-4 p-3.5 rounded-xl border flex items-center space-x-3 ${
            verification.valid
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-rose-50/70 border-rose-200 text-rose-900'
          }`}
        >
          {verification.valid ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <div className="text-xs leading-relaxed">
            <div className="font-bold">
              {verification.valid ? 'ALL AUDIT CHECKS PASSED' : 'COMPLIANCE VIOLATIONS DETECTED'}
            </div>
            <div>
              {verification.valid
                ? 'The 24-hour hourly plan satisfies all linear programming constraints, physical balance equations, and operator directives.'
                : `${verification.violations.length} constraint violation(s) identified during replay analysis.`}
            </div>
          </div>
        </div>

        {/* Individual Check List */}
        <div className="mt-4 space-y-2.5">
          {checks.map((c, i) => (
            <div
              key={i}
              className="flex items-start justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 text-xs"
            >
              <div className="pr-2">
                <div className="font-semibold text-slate-800">{c.title}</div>
                <div className="text-[11px] text-slate-500">{c.desc}</div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                  c.status
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {c.status ? 'PASS' : 'FAIL'}
              </span>
            </div>
          ))}
        </div>

        {/* Violations Details if any */}
        {verification.violations.length > 0 && (
          <div className="mt-4 p-3 bg-rose-50 rounded-lg border border-rose-200 text-xs text-rose-800">
            <div className="font-bold mb-1">Violation Log:</div>
            <ul className="list-disc list-inside space-y-0.5">
              {verification.violations.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
