const fs = require('fs');

let code = fs.readFileSync('src/context/ScrapingContext.jsx', 'utf8');

const newStates = `  const [scanPhase, setScanPhase] = useState('idle');\n`;
code = code.replace('  const [termino, setTermino]', newStates + '  const [termino, setTermino]');
code = code.replace('const [sources, setSources] = useState({ maps: true, facebook: true });', 'const [sources, setSources] = useState({ maps: true, facebook: false });');

const newValues = `    scanPhase, setScanPhase,\n`;
code = code.replace('  const value = {', '  const value = {\n' + newValues);

fs.writeFileSync('src/context/ScrapingContext.jsx', code);

let viewCode = fs.readFileSync('src/components/ScrapingView.jsx', 'utf8');
const viewVars = `    scanPhase, setScanPhase,\n`;
viewCode = viewCode.replace('  const {', '  const {\n' + viewVars);

fs.writeFileSync('src/components/ScrapingView.jsx', viewCode);
console.log('Context updated');
