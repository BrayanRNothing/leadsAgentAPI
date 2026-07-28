const fs = require('fs');

let code = fs.readFileSync('src/components/HistoryView.jsx', 'utf8');

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

  return (`;

code = code.replace('  return (', deleteFn);

fs.writeFileSync('src/components/HistoryView.jsx', code);
console.log('Fixed HistoryView');
