const express = require('express');
const router = express.Router();
const prisma = require('../prisma');

const QUALIFIED_KEYWORDS = [
  'hotel', 'resort', 'motel', 'hospedaje', 'posada',
  'hospital', 'clinica', 'sanatorio', 'medico', 'salud',
  'comercial', 'plaza', 'supermercado', 'mall', 'corporativo', 'departamental',
  'industria', 'fabrica', 'planta', 'manufactura'
];

const keywordOrConditions = QUALIFIED_KEYWORDS.flatMap(kw => [
  { nombre: { contains: kw, mode: 'insensitive' } },
  { categoria: { contains: kw, mode: 'insensitive' } }
]);

// GET /api/inegi/stats
// Devuelve un conteo de leads calificados y agrupados por categoría
router.get('/stats', async (req, res) => {
  try {
    const baseWhere = {
      correo: { not: null, not: '' },
      status: 'active',
      OR: keywordOrConditions
    };

    const total = await prisma.inegiLead.count({ where: baseWhere });

    const categoriasRaw = await prisma.inegiLead.groupBy({
      by: ['categoria'],
      where: baseWhere,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });

    const categorias = categoriasRaw.map(c => ({
      nombre: c.categoria || 'Sin Categoría',
      count: c._count.id
    }));

    res.json({ total, categorias });
  } catch (error) {
    console.error('Error obteniendo stats de inegi:', error.message);
    res.status(500).json({ error: 'Error al obtener stats' });
  }
});

// GET /api/inegi/leads?page=1&limit=50&search=Aguscalientes&categoria=Hotel
router.get('/leads', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const { search, categoria } = req.query;

    const andConditions = [
      { correo: { not: null, not: '' } },
      { status: 'active' },
      { OR: keywordOrConditions }
    ];

    if (search) {
      andConditions.push({
        OR: [
          { ubicacion: { contains: search, mode: 'insensitive' } },
          { nombre: { contains: search, mode: 'insensitive' } }
        ]
      });
    }

    if (categoria) {
      andConditions.push({ categoria: { contains: categoria, mode: 'insensitive' } });
    }

    const where = { AND: andConditions };

    const [leads, total] = await Promise.all([
      prisma.inegiLead.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { id: 'desc' }
      }),
      prisma.inegiLead.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      data: leads,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error obteniendo leads de inegi:', error.message);
    res.status(500).json({ error: 'Error al obtener leads' });
  }
});

// POST /api/inegi/apartar
router.post('/apartar', async (req, res) => {
  try {
    const { inegiLeadId } = req.body;
    
    // Find the lead in InegiLead table
    const inegiLead = await prisma.inegiLead.findUnique({
      where: { id: parseInt(inegiLeadId) }
    });

    if (!inegiLead) return res.status(404).json({ error: 'Lead no encontrado' });

    // Copy it to the main Lead table
    const newLead = await prisma.lead.create({
      data: {
        nombre: inegiLead.nombre,
        telefono: inegiLead.telefono,
        sitioWeb: inegiLead.sitioWeb,
        correo: inegiLead.correo,
        direccion: inegiLead.direccion,
        categoria: inegiLead.categoria,
        terminoBusqueda: inegiLead.terminoBusqueda,
        ubicacion: inegiLead.ubicacion,
        lat: inegiLead.lat,
        lng: inegiLead.lng,
        fuente: 'inegi_saved',
        status: 'active'
      }
    });

    res.json(newLead);
  } catch (error) {
    console.error('Error apartando lead inegi:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
