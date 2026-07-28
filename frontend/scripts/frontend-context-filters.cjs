const fs = require('fs');

let code = fs.readFileSync('src/context/ScrapingContext.jsx', 'utf8');

const newStates = `  const [reqFilters, setReqFilters] = useState({ phone: false, email: false, website: false });\n`;
code = code.replace("  const [scanPhase, setScanPhase] = useState('idle');", "  const [scanPhase, setScanPhase] = useState('idle');\n" + newStates);

const newValues = `    reqFilters, setReqFilters,\n`;
code = code.replace('    scanPhase, setScanPhase,', '    scanPhase, setScanPhase,\n' + newValues);

fs.writeFileSync('src/context/ScrapingContext.jsx', code);

let viewCode = fs.readFileSync('src/components/ScrapingView.jsx', 'utf8');
const viewVars = `    reqFilters, setReqFilters,\n`;
viewCode = viewCode.replace('    scanPhase, setScanPhase,', '    scanPhase, setScanPhase,\n' + viewVars);

fs.writeFileSync('src/components/ScrapingView.jsx', viewCode);
console.log('Context filters updated');
