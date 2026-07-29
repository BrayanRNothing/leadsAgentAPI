require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const json2csv = require('json2csv').parse;

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

// Obtener categorías agrupadas por término y ubicación
router.get('/categorias', async (req, res) => {
  try {
    const leadsGroups = await prisma.mapsLead.groupBy({
      by: ['terminoBusqueda', 'ubicacion'],
      where: {
        status: { not: 'discarded' }
      },
      _count: {
        _all: true
      }
    });

    const response = leadsGroups.map((g, i) => ({
      id: i,
      termino: g.terminoBusqueda,
      ubicacion: g.ubicacion || 'General',
      _count: { leads: g._count._all }
    }));

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching categories' });
  }
});

// Obtener leads de una categoría específica
router.get('/categorias/:termino/leads', async (req, res) => {
  try {
    const { termino } = req.params;
    const { ubicacion } = req.query;

    const whereObj = {
      status: { not: 'discarded' }
    };
    
    if (termino !== 'ALL') {
      whereObj.terminoBusqueda = termino;
      if (ubicacion && ubicacion !== 'General') {
        whereObj.ubicacion = ubicacion;
      } else if (ubicacion === 'General') {
        whereObj.ubicacion = null;
      }
    }

    const leads = await prisma.mapsLead.findMany({
      where: whereObj,
      orderBy: { creadoEn: 'desc' }
    });
    res.json(leads);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching leads' });
  }
});

// Eliminar categoría entera
router.delete('/categorias/:termino', async (req, res) => {
  const { termino } = req.params;
  const { ubicacion } = req.query;
  
  try {
    const whereObj = {};
    if (termino !== 'ALL') {
      whereObj.terminoBusqueda = termino;
      if (ubicacion && ubicacion !== 'General') {
        whereObj.ubicacion = ubicacion;
      } else if (ubicacion === 'General') {
        whereObj.ubicacion = null;
      }
    }

    await prisma.mapsLead.deleteMany({
      where: whereObj
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Exportar CSV
router.get('/exportar/:termino', async (req, res) => {
  const { termino } = req.params;
  const { ubicacion } = req.query;
  
  try {
    const whereObj = {
      status: { not: 'discarded' }
    };
    
    if (termino !== 'ALL') {
      whereObj.terminoBusqueda = termino;
      if (ubicacion && ubicacion !== 'General') {
        whereObj.ubicacion = ubicacion;
      } else if (ubicacion === 'General') {
        whereObj.ubicacion = null;
      }
    }

    const leads = await prisma.mapsLead.findMany({
      where: whereObj
    });

    if (leads.length === 0) {
      return res.status(404).send('No hay leads para exportar');
    }

    const fields = ['nombre', 'telefono', 'correo', 'sitioWeb', 'direccion', 'categoria', 'calificacion', 'reviews'];
    const csv = json2csv(leads, { fields });

    res.header('Content-Type', 'text/csv');
    res.attachment(`maps_leads_${termino}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting leads:', error);
    res.status(500).send('Error interno del servidor');
  }
});

module.exports = router;
