const fs = require('fs');

let code = fs.readFileSync('src/components/HistoryView.jsx', 'utf8');

// 1. Add Trash2 to imports
code = code.replace(/import { (.*?) } from 'lucide-react';/, "import { $1, Trash2 } from 'lucide-react';");

// 2. Add deleteSearch function inside HistoryView
const deleteFn = `
  const deleteSearch = async (e, id, termino) => {
    e.stopPropagation();
    if (!window.confirm(\`¿Seguro que quieres borrar toda la búsqueda de "\${termino}" y sus leads para siempre?\`)) return;
    
    try {
      await axios.delete(\`http://localhost:3001/api/leads/categorias/\${id}\`);
      setCategorias(prev => prev.filter(c => c.id !== id));
      if (expandedCat === termino) {
        setExpandedCat(null);
      }
    } catch (error) {
      console.error("Error al borrar la búsqueda", error);
    }
  };

  const exportToCSV = `;

code = code.replace('  const exportToCSV = ', deleteFn);

// 3. Add Trash button inside category card
const cardContent = `
                <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors"></div>
                <button 
                  onClick={(e) => deleteSearch(e, c.id, c.termino)}
                  className="absolute top-2 right-2 p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors z-10"
                  title="Borrar búsqueda"
                >
                  <Trash2 size={16} />
                </button>
                <h3 className="text-lg font-bold text-gray-800 capitalize mb-3 line-clamp-2 px-2">`;

code = code.replace(`
                <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors"></div>
                <h3 className="text-lg font-bold text-gray-800 capitalize mb-3 line-clamp-2 px-2">`, cardContent);

fs.writeFileSync('src/components/HistoryView.jsx', code);
console.log('Frontend delete logic added');
