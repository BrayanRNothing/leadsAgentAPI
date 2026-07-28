const fs = require('fs');
const filePath = '../frontend/src/components/ScrapingView.jsx';
let code = fs.readFileSync(filePath, 'utf8');

const oldTerminal = `<div className="w-full h-full min-h-[300px] flex flex-col bg-white rounded-2xl overflow-hidden font-mono text-xs shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] border border-gray-200">
              <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2 border-b border-gray-200">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                </div>
                <span className="text-gray-600 font-bold ml-2">Terminal del Bot</span>
              </div>
              <div className="flex-1 p-4 overflow-y-auto bg-white text-gray-700 space-y-1">
                {logs.length === 0 ? (
                  <div className="text-gray-400 italic">Esperando inicio de proceso...</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex gap-3 hover:bg-gray-50 px-1 py-0.5 rounded">
                      <span className="text-gray-400 select-none shrink-0">{\`[\${new Date().toLocaleTimeString('es-MX', {hour12:false})}]\`}</span>
                      <span className="break-words flex-1 leading-relaxed">{log}</span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>`;

const newTerminal = `<div className="w-full h-full min-h-[450px] flex flex-col gap-3 font-mono text-[11px]">
              {/* Bot Central (Engine) */}
              <div className="flex-1 min-h-[120px] flex flex-col bg-white rounded-xl overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] border border-gray-200">
                <div className="bg-gray-50 px-3 py-1.5 flex items-center justify-between border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-blue-700 font-bold">🤖 Orquestador Principal</span>
                  </div>
                </div>
                <div className="flex-1 p-2 overflow-y-auto bg-white text-gray-700 space-y-1 flex flex-col-reverse">
                  {logs.filter(l => l.includes('[Engine]') || l.includes('[Filtro]')).reverse().map((log, i) => (
                    <div key={i} className="flex gap-2 hover:bg-gray-50 px-1 rounded">
                      <span className="text-gray-400 select-none shrink-0">{\`[\${new Date().toLocaleTimeString('es-MX', {hour12:false})}]\`}</span>
                      <span className="break-words flex-1 leading-relaxed text-blue-800">{log}</span>
                    </div>
                  ))}
                  {logs.length === 0 && <div className="text-gray-400 italic px-1">Esperando inicio...</div>}
                </div>
              </div>
              
              {/* Bot Esteban (Maps) */}
              <div className="flex-1 min-h-[120px] flex flex-col bg-white rounded-xl overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] border border-gray-200">
                <div className="bg-gray-50 px-3 py-1.5 flex items-center justify-between border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></div>
                    <span className="text-orange-700 font-bold">📍 Bot Esteban (Buscador)</span>
                  </div>
                </div>
                <div className="flex-1 p-2 overflow-y-auto bg-white text-gray-700 space-y-1 flex flex-col-reverse">
                  {logs.filter(l => l.includes('[Maps]')).reverse().map((log, i) => (
                    <div key={i} className="flex gap-2 hover:bg-gray-50 px-1 rounded">
                      <span className="text-gray-400 select-none shrink-0">{\`[\${new Date().toLocaleTimeString('es-MX', {hour12:false})}]\`}</span>
                      <span className="break-words flex-1 leading-relaxed text-orange-800">{log}</span>
                    </div>
                  ))}
                  {logs.length === 0 && <div className="text-gray-400 italic px-1">En espera...</div>}
                </div>
              </div>

              {/* Bot Pedrito (Enrichment) */}
              <div className="flex-1 min-h-[120px] flex flex-col bg-white rounded-xl overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] border border-gray-200">
                <div className="bg-gray-50 px-3 py-1.5 flex items-center justify-between border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-green-700 font-bold">🌐 Bot Pedrito (Analista Web)</span>
                  </div>
                </div>
                <div className="flex-1 p-2 overflow-y-auto bg-white text-gray-700 space-y-1 flex flex-col-reverse">
                  {logs.filter(l => l.includes('[Enrichment]') || l.includes('[BD]')).reverse().map((log, i) => (
                    <div key={i} className="flex gap-2 hover:bg-gray-50 px-1 rounded">
                      <span className="text-gray-400 select-none shrink-0">{\`[\${new Date().toLocaleTimeString('es-MX', {hour12:false})}]\`}</span>
                      <span className="break-words flex-1 leading-relaxed text-green-800">{log}</span>
                    </div>
                  ))}
                  {logs.length === 0 && <div className="text-gray-400 italic px-1">En espera...</div>}
                </div>
              </div>
            </div>`;

code = code.replace(oldTerminal, newTerminal);
fs.writeFileSync(filePath, code);
console.log('Multiple terminals added!');
