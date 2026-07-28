const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

// GET /api/inegi/stats
// Devuelve un conteo de leads totales y agrupados por categoría para fuente 'inegi'
router.get('/stats', async (req, res) => {
  try {
    const total = await prisma.inegiLead.count();

    const categoriasRaw = await prisma.inegiLead.groupBy({
      by: ['categoria'],
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
    const { search, categoria, telefono, correo } = req.query;

    const where = {};
    const andConditions = [];
    
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

    if (telefono === 'true') {
      andConditions.push({ telefono: { not: null } });
    }
    
    if (correo === 'true') {
      andConditions.push({ correo: { not: null } });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }
    
    // Ocultar leads descartados globalmente
    where.status = { not: 'discarded' };

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
