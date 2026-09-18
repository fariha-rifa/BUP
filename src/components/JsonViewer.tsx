import { Check, Copy, Terminal } from 'lucide-react';
import React, { useState } from 'react';
import { OptimizeEnergyRequest, OptimizeEnergyResponse } from '../types.ts';

interface JsonViewerProps {
  requestPayload: OptimizeEnergyRequest;
  responsePayload: OptimizeEnergyResponse | null;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({
  requestPayload,
  responsePayload,
}) => {
  const [activeTab, setActiveTab] = useState<'response' | 'request' | 'curl'>('response');
  const [copied, setCopied] = useState(false);

  const curlCommand = `curl -X POST http://localhost:3000/optimize-energy \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(requestPayload)}'`;

  const copyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActiveText = () => {
    if (activeTab === 'curl') return curlCommand;
    if (activeTab === 'request') return JSON.stringify(requestPayload, null, 2);
    return responsePayload ? JSON.stringify(responsePayload, null, 2) : 'No response payload yet.';
  };

  return (
    <div id="json-viewer-container" className="bg-slate-900 rounded-xl overflow-hidden mb-6 border border-slate-800 shadow-md">
      <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            API Payload Inspector & CLI Replay
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('response')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'response'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Response JSON
            </button>
            <button
              onClick={() => setActiveTab('request')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'request'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Request JSON
            </button>
            <button
              onClick={() => setActiveTab('curl')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'curl'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              cURL Command
            </button>
          </div>

          <button
            onClick={() => copyContent(getActiveText())}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 max-h-80 overflow-y-auto font-mono text-xs text-emerald-400 bg-slate-900/90 leading-relaxed select-all">
        <pre>{getActiveText()}</pre>
      </div>
    </div>
  );
};
