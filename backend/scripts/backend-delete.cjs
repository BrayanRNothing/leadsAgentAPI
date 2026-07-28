const fs = require('fs');

let code = fs.readFileSync('src/routes/leads.js', 'utf8');

const deleteEndpoint = `
// Borrar una categoría (y todos sus leads)
router.delete('/categorias/:id', async (req, res) => {
  const { id } = req.params;
  const [termino, ...ubicParts] = id.split('__');
  const ubicacion = ubicParts.join('__') || null;
  
  try {
    const result = await prisma.lead.deleteMany({
      where: {
        terminoBusqueda: termino,
        ...(ubicacion ? { ubicacion } : {})
      }
    });
    res.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Error borrando búsqueda:', error.message);
    res.status(500).json({ error: 'Error al borrar búsqueda: ' + error.message });
  }
});

// Cambiar el estado`;

code = code.replace('// Cambiar el estado', deleteEndpoint);

fs.writeFileSync('src/routes/leads.js', code);
console.log('Backend delete endpoint added');
