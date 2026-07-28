const fs = require('fs');

let code = fs.readFileSync('src/components/BentoGrid.jsx', 'utf8');

const importsToAdd = "import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';\n";
code = code.replace("import { Search, Database, LogOut, ArrowLeft, Radar } from 'lucide-react';", importsToAdd + "import { Search, Database, LogOut, ArrowLeft, Radar } from 'lucide-react';");

code = code.replace('export default function BentoGrid({ isAuthenticated, onLogin, onLogout }) {', 'export default function BentoGrid({ isAuthenticated, onLogin, onLogout }) {\n  const navigate = useNavigate();\n  const location = useLocation();');

code = code.replace('  const [expandedId, setExpandedId] = useState(null);', '');
code = code.replace('  const expandedItem = mainCards.find(c => c.id === expandedId);', '');

code = code.replace(/<AnimatePresence mode="wait">.*?<\/AnimatePresence>/s, `
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={
            <motion.div
              key="home"
              className="w-full flex flex-col items-center gap-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex flex-col gap-6 w-full max-w-md mx-auto relative z-20 mb-32">
                {mainCards.map((card, i) => (
                  <ActionCard
                    key={card.id}
                    item={card}
                    index={i}
                    onClick={() => navigate('/' + card.id)}
                  />
                ))}
              </div>
            </motion.div>
          } />
          {mainCards.map(card => (
            <Route key={card.id} path={'/' + card.id} element={
              <motion.div
                key="expanded"
                className="fixed inset-0 z-50 flex flex-col overflow-hidden"
                style={{ background: '#e0e5ec' }}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                <div className="flex-1 overflow-hidden pt-2">
                  {React.cloneElement(card.component, { onBack: () => navigate('/') })}
                </div>
              </motion.div>
            } />
          ))}
        </Routes>
      </AnimatePresence>
`);

fs.writeFileSync('src/components/BentoGrid.jsx', code);
console.log('BentoGrid refactored');
