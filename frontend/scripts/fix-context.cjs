const fs = require('fs');

let code = fs.readFileSync('src/context/ScrapingContext.jsx', 'utf8');

const newStates = `  const [selectedStates, setSelectedStates] = useState([]);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [termValidated, setTermValidated] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [scanStartTime, setScanStartTime] = useState(null);
  const [eta, setEta] = useState('');
`;

code = code.replace('  const [termino, setTermino]', newStates + '  const [termino, setTermino]');

const newValues = `    selectedStates, setSelectedStates,
    locationConfirmed, setLocationConfirmed,
    termValidated, setTermValidated,
    validationMessage, setValidationMessage,
    scanStartTime, setScanStartTime,
    eta, setEta,\n`;

code = code.replace('  const value = {', '  const value = {\n' + newValues);
fs.writeFileSync('src/context/ScrapingContext.jsx', code);


let viewCode = fs.readFileSync('src/components/ScrapingView.jsx', 'utf8');
const viewVars = `    selectedStates, setSelectedStates,
    locationConfirmed, setLocationConfirmed,
    termValidated, setTermValidated,
    validationMessage, setValidationMessage,
    scanStartTime, setScanStartTime,
    eta, setEta,\n`;

viewCode = viewCode.replace('  const {', '  const {\n' + viewVars);

viewCode = viewCode.replace(/^\s*const \[selectedStates.*?;/gm, '');
viewCode = viewCode.replace(/^\s*const \[locationConfirmed.*?;/gm, '');
viewCode = viewCode.replace(/^\s*const \[termValidated.*?;/gm, '');
viewCode = viewCode.replace(/^\s*const \[validationMessage.*?;/gm, '');
viewCode = viewCode.replace(/^\s*const \[scanStartTime.*?;/gm, '');
viewCode = viewCode.replace(/^\s*const \[eta, setEta.*?;/gm, '');

fs.writeFileSync('src/components/ScrapingView.jsx', viewCode);
console.log('Done');
