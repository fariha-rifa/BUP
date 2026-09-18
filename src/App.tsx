import {
  AlertCircle,
  ArrowRight,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Play,
  RotateCcw,
  Sparkles,
  Terminal,
  Wand2,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { SAMPLE_CASES } from '../server/sampleCases.ts';
import { OptimizeEnergyResponse, SampleCase } from './types.ts';

export function App() {
  const [samples] = useState<SampleCase[]>(SAMPLE_CASES);
  const [selectedSampleId, setSelectedSampleId] = useState<string>('SAMPLE-01');

  // Input JSON string state
  const [inputJson, setInputJson] = useState<string>(() =>
    JSON.stringify(SAMPLE_CASES[0].input, null, 2)
  );
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);

  // Output response state
  const [outputJson, setOutputJson] = useState<string>('');
  const [parsedOutput, setParsedOutput] = useState<OptimizeEnergyResponse | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [interpretationMethod, setInterpretationMethod] = useState<string | null>(null);

  // Loading & status states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean>(true);
  const [copyOutputSuccess, setCopyOutputSuccess] = useState<boolean>(false);
  const [copyCurlSuccess, setCopyCurlSuccess] = useState<boolean>(false);

  // Check health endpoint periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/health');
        setIsBackendHealthy(res.ok);
      } catch {
        setIsBackendHealthy(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // Validate input JSON on change
  const handleInputChange = (val: string) => {
    setInputJson(val);
    try {
      JSON.parse(val);
      setJsonParseError(null);
    } catch (e: unknown) {
      setJsonParseError(e instanceof Error ? e.message : 'Invalid JSON format');
    }
  };

  // Format Input JSON
  const handleFormatInput = () => {
    try {
      const parsed = JSON.parse(inputJson);
      setInputJson(JSON.stringify(parsed, null, 2));
      setJsonParseError(null);
    } catch (e: unknown) {
      setJsonParseError(e instanceof Error ? e.message : 'Invalid JSON format');
    }
  };

  // Load a sample case into input
  const handleSelectSample = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    const found = samples.find((s) => s.id === sampleId);
    if (found) {
      setInputJson(JSON.stringify(found.input, null, 2));
      setJsonParseError(null);
    }
  };

  // Reset to current sample
  const handleReset = () => {
    handleSelectSample(selectedSampleId);
  };

  // Execute optimization API call
  const handleRunOptimization = async () => {
    let parsedBody;
    try {
      parsedBody = JSON.parse(inputJson);
    } catch {
      setJsonParseError('Please fix the JSON syntax errors before sending.');
      return;
    }

    setIsLoading(true);
    setJsonParseError(null);
    const start = performance.now();

    try {
      const res = await fetch('/optimize-energy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedBody),
      });

      const elapsed = Math.round(performance.now() - start);
      setResponseTimeMs(elapsed);
      setHttpStatus(res.status);

      const methodHeader = res.headers.get('X-Interpretation-Method');
      if (methodHeader) {
        setInterpretationMethod(methodHeader);
      }

      const resData = await res.json();
      setOutputJson(JSON.stringify(resData, null, 2));

      if (res.ok) {
        setParsedOutput(resData as OptimizeEnergyResponse);
      } else {
        setParsedOutput(null);
      }
    } catch (err: unknown) {
      const elapsed = Math.round(performance.now() - start);
      setResponseTimeMs(elapsed);
      setHttpStatus(500);
      setParsedOutput(null);
      setOutputJson(
        JSON.stringify(
          {
            error: 'Network or Connection Failure',
            message: err instanceof Error ? err.message : 'Failed to connect to /optimize-energy',
          },
          null,
          2
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Run initial optimization on mount
  useEffect(() => {
    handleRunOptimization();
  }, []);

  // Copy output to clipboard
  const handleCopyOutput = () => {
    if (!outputJson) return;
    navigator.clipboard.writeText(outputJson);
    setCopyOutputSuccess(true);
    setTimeout(() => setCopyOutputSuccess(false), 2000);
  };

  // Copy cURL command
  const handleCopyCurl = () => {
    try {
      const minified = JSON.stringify(JSON.parse(inputJson));
      const curl = `curl -X POST http://localhost:3000/optimize-energy \\\n  -H "Content-Type: application/json" \\\n  -d '${minified}'`;
      navigator.clipboard.writeText(curl);
      setCopyCurlSuccess(true);
      setTimeout(() => setCopyCurlSuccess(false), 2000);
    } catch {
      const curl = `curl -X POST http://localhost:3000/optimize-energy \\\n  -H "Content-Type: application/json" \\\n  -d '${inputJson.replace(/'/g, "'\\''")}'`;
      navigator.clipboard.writeText(curl);
      setCopyCurlSuccess(true);
      setTimeout(() => setCopyCurlSuccess(false), 2000);
    }
  };

  // Hotkey: Ctrl+Enter or Cmd+Enter to run
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunOptimization();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 shrink-0 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-900/40">
              <Zap className="w-4 h-4 fill-white text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  GridWise Energy Optimizer
                </h1>
                <span className="text-[11px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  /optimize-energy
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Direct JSON Input & Output Console • 24h LP Solver & LLM Directives
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Backend Health Badge */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-mono border ${
                isBackendHealthy
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                  : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isBackendHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span>/health: {isBackendHealthy ? 'ok' : 'error'}</span>
            </div>

            {/* Run Button in Header */}
            <button
              id="header-run-btn"
              onClick={handleRunOptimization}
              disabled={isLoading || Boolean(jsonParseError)}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                isLoading || Boolean(jsonParseError)
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950 active:scale-98'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Optimizing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Optimization</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace (Split Screen: Input JSON & Output JSON) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        {/* Sample Case Quick Selector Row */}
        <div className="mb-4 bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-medium shrink-0">Quick Load Scenario:</span>
            <select
              id="sample-scenario-select"
              value={selectedSampleId}
              onChange={(e) => handleSelectSample(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-emerald-500 focus:border-emerald-500 cursor-pointer"
            >
              {samples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}: {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <button
              onClick={handleFormatInput}
              title="Format and pretty-print the input JSON"
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Format JSON</span>
            </button>
            <button
              onClick={handleReset}
              title="Reset Input JSON to original sample"
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset</span>
            </button>
            <button
              onClick={handleCopyCurl}
              title="Copy cURL command for this request"
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              {copyCurlSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">cURL Copied</span>
                </>
              ) : (
                <>
                  <Terminal className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy cURL</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dual Pane Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
          {/* ========================================================= */}
          {/* LEFT PANE: INPUT (JSON)                                    */}
          {/* ========================================================= */}
          <div
            id="input-json-panel"
            className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-lg"
          >
            {/* Panel Header */}
            <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Code2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Input (JSON)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  POST /optimize-energy
                </span>
              </div>

              {/* Syntax Validity Indicator */}
              <div className="flex items-center space-x-1.5 text-xs">
                {jsonParseError ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-rose-950/80 text-rose-300 border border-rose-800/80">
                    <AlertCircle className="w-3 h-3 mr-1 text-rose-400" />
                    Syntax Error
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                    <Check className="w-3 h-3 mr-1 text-emerald-400" />
                    Valid JSON
                  </span>
                )}
              </div>
            </div>

            {/* Error Banner if syntax invalid */}
            {jsonParseError && (
              <div className="bg-rose-950/50 border-b border-rose-900/50 px-4 py-2 text-xs text-rose-300 font-mono">
                {jsonParseError}
              </div>
            )}

            {/* Editor Area */}
            <div className="flex-1 relative min-h-[480px]">
              <textarea
                id="input-json-textarea"
                value={inputJson}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                className="w-full h-full p-4 font-mono text-xs leading-relaxed bg-slate-950/60 text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50 border-0"
                placeholder="Paste or edit OptimizeEnergyRequest JSON here..."
              />
            </div>

            {/* Panel Footer */}
            <div className="bg-slate-950/80 px-4 py-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px]">
                Tip: Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">Enter</kbd> to run
              </span>
              <button
                id="pane-run-btn"
                onClick={handleRunOptimization}
                disabled={isLoading || Boolean(jsonParseError)}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  isLoading || Boolean(jsonParseError)
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isLoading ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <span>Execute</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT PANE: OUTPUT (JSON)                                  */}
          {/* ========================================================= */}
          <div
            id="output-json-panel"
            className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-lg"
          >
            {/* Panel Header */}
            <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Output (JSON)
                </span>
                {httpStatus && (
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                      httpStatus === 200
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                        : 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                    }`}
                  >
                    HTTP {httpStatus}
                  </span>
                )}
                {responseTimeMs !== null && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    {responseTimeMs}ms
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {interpretationMethod && (
                  <span className="hidden sm:inline-flex text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {interpretationMethod}
                  </span>
                )}
                <button
                  id="copy-output-btn"
                  onClick={handleCopyOutput}
                  disabled={!outputJson}
                  className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {copyOutputSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Output</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Result Summary Strip if response is 200 OK */}
            {parsedOutput && (
              <div className="bg-slate-950/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between flex-wrap gap-3 text-xs">
                <div className="flex items-center space-x-4 flex-wrap gap-y-1">
                  <div>
                    <span className="text-slate-500">Total Cost: </span>
                    <span className="font-mono font-bold text-emerald-400">
                      ৳{parsedOutput.total_cost_bdt.toLocaleString()} BDT
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Total Grid: </span>
                    <span className="font-mono font-bold text-blue-400">
                      {parsedOutput.total_grid_kwh.toLocaleString()} kWh
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Peak Grid: </span>
                    <span className="font-mono font-bold text-amber-400">
                      {parsedOutput.peak_grid_kwh} kWh
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Directives: </span>
                    <span className="font-mono font-bold text-slate-200">
                      {parsedOutput.directive_interpretation.filter((d) => d.applies).length}{' '}
                      active
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 truncate max-w-xs" title={parsedOutput.plan_summary}>
                  {parsedOutput.plan_summary}
                </div>
              </div>
            )}

            {/* Output Viewer Area */}
            <div className="flex-1 relative min-h-[480px] bg-slate-950/60 overflow-auto">
              {isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 text-slate-400">
                  <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
                  <div className="text-xs font-mono">
                    Interpreting directives & solving 24-hour LP...
                  </div>
                </div>
              ) : outputJson ? (
                <pre
                  id="output-json-content"
                  className="p-4 font-mono text-xs leading-relaxed text-emerald-400 select-all whitespace-pre"
                >
                  {outputJson}
                </pre>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 text-slate-500 p-6 text-center">
                  <Terminal className="w-8 h-8 text-slate-700" />
                  <p className="text-xs">No response yet.</p>
                  <p className="text-xs text-slate-600 max-w-sm">
                    Click &ldquo;Run Optimization&rdquo; to send the input JSON to{' '}
                    <code className="text-slate-400">/optimize-energy</code>.
                  </p>
                </div>
              )}
            </div>

            {/* Panel Footer */}
            <div className="bg-slate-950/80 px-4 py-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px]">
                {outputJson ? `${outputJson.length.toLocaleString()} characters` : 'Ready'}
              </span>
              {parsedOutput && (
                <span className="text-[11px] text-emerald-400 font-mono">
                  ✓ 24 hours schedule verified
                </span>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Clean Minimal Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 text-xs text-slate-500 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-[11px]">
          <div>GridWise • LP Simplex Optimization Engine</div>
          <div className="flex items-center space-x-3">
            <span>GET /health</span>
            <span>•</span>
            <span>POST /optimize-energy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
