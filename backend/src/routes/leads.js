require('dotenv').config();
const express = require('express');
const router = express.Router();
const prisma = require('../prisma');

// Obtener categorías agrupadas por término y ubicación
router.get('/categorias', async (req, res) => {
  try {
    const leadsGroups = await prisma.lead.groupBy({
      by: ['terminoBusqueda', 'ubicacion'],
      where: {
        status: { not: 'discarded' },
        pipelineState: { notIn: ['REPLIED', 'INTERESTED', 'FOLLOW_UP', 'NOT_INTERESTED', 'DISCARDED'] }
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
      pipelineState: { notIn: ['REPLIED', 'INTERESTED', 'FOLLOW_UP', 'NOT_INTERESTED', 'DISCARDED'] }
    };
    
    if (termino !== 'ALL') {
      whereObj.terminoBusqueda = termino;
      if (ubicacion && ubicacion !== 'General') {
        whereObj.ubicacion = ubicacion;
      } else if (ubicacion === 'General') {
        whereObj.ubicacion = null;
      }
    }

    const leads = await prisma.lead.findMany({
      where: whereObj,
      orderBy: { id: 'desc' }
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

    const result = await prisma.lead.deleteMany({
      where: whereObj
    });
    res.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Error borrando búsqueda:', error.message);
    res.status(500).json({ error: 'Error al borrar búsqueda: ' + error.message });
  }
});

// Crear un lead manualmente
router.post('/', async (req, res) => {
  try {
    const newLead = await prisma.lead.create({
      data: req.body
    });
    res.json(newLead);
  } catch (error) {
    console.error('Error al crear lead manualmente:', error);
    res.status(500).json({ error: 'Error al crear lead manualmente' });
  }
});

// Cambiar el estado de un lead (Activo / Descartado)
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    // Cuando se descarta, también cambiar pipelineState a DISCARDED
    // Cuando se restaura, poner pipelineState de vuelta a NEW
    const updateData = { status };
    if (status === 'discarded') {
      updateData.pipelineState = 'DISCARDED';
    } else if (status === 'active') {
      updateData.pipelineState = 'NEW';
    }

    const lead = await prisma.lead.update({
      where: { id: Number(id) },
      data: updateData
    });
    
    // Si el lead viene de INEGI, también actualizar en InegiLead global para tacharlo
    if (['inegi_saved', 'inegi'].includes(lead.fuente)) {
      await prisma.inegiLead.updateMany({
        where: {
          nombre: lead.nombre,
          telefono: lead.telefono
        },
        data: {
          status: status
        }
      });
    }

    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar estado: ' + error.message });
  }
});

// Eliminar (Regresar) un lead de la tabla Lead
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.lead.delete({
      where: { id: Number(id) }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar lead: ' + error.message });
  }
});

// Exportar CSV
router.get('/exportar/:termino', async (req, res) => {
  const { termino } = req.params;
  const { ubicacion } = req.query;
  
  try {
    const whereObj = {
      terminoBusqueda: termino
    };
    
    if (ubicacion && ubicacion !== 'General') {
      whereObj.ubicacion = ubicacion;
    } else if (ubicacion === 'General') {
      whereObj.ubicacion = null;
    }

    const leads = await prisma.lead.findMany({
      where: whereObj
    });

    // Helper para escapar campos CSV (RFC 4180)
    const csvEscape = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Si contiene coma, comilla o salto de línea, envolver en comillas y escapar las comillas internas
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    // Cabecera
    const rows = ['Nombre,Telefono,Correo,Empresa,Sitio Web,Direccion,Fuente,Facebook,Instagram,Twitter,LinkedIn,Notas'];

    leads.forEach(lead => {
      let redesObj = {};
      if (lead.redesSociales) {
        try {
          redesObj = typeof lead.redesSociales === 'string' ? JSON.parse(lead.redesSociales) : lead.redesSociales;
        } catch (e) {}
      }

      // Si el lead vino de Facebook y no tiene redes guardadas, usar sitioWeb como perfil de Facebook
      if (!redesObj.facebook && lead.fuente && lead.fuente.toLowerCase() === 'facebook' && lead.sitioWeb) {
        redesObj.facebook = lead.sitioWeb;
      }

      const notas = [
        lead.calificacion ? `Rating: ${lead.calificacion}` : '',
        lead.reviews ? `Reviews: ${lead.reviews}` : '',
        lead.categoria ? `Categoría: ${lead.categoria}` : ''
      ].filter(Boolean).join(' | ');

      let tel = lead.telefono || '';
      if (tel) {
        tel = tel.replace(/[^\d+]/g, '');
        if (tel && !tel.startsWith('+')) tel = '+52' + tel;
      }

      // Empresa: usar categoria si no hay un campo empresa dedicado
      const empresa = lead.categoria && lead.categoria !== 'Social' && lead.categoria !== 'Facebook' && lead.categoria !== 'Instagram' && lead.categoria !== 'LinkedIn'
        ? lead.categoria
        : lead.nombre;

      rows.push([
        csvEscape(lead.nombre),
        csvEscape(tel ? '\\t' + tel : ''),
        csvEscape(lead.correo || ''),
        csvEscape(empresa),
        csvEscape(lead.sitioWeb || ''),
        csvEscape(lead.direccion || ''),
        csvEscape(lead.fuente || ''),
        csvEscape(redesObj.facebook || ''),
        csvEscape(redesObj.instagram || ''),
        csvEscape(redesObj.twitter || ''),
        csvEscape(redesObj.linkedin || ''),
        csvEscape(notas)
      ].join(','));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n'); // BOM UTF-8 para que Excel lo abra bien
    const filename = (ubicacion ? `leads_${termino}_${ubicacion}` : `leads_${termino}`)
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_\-]/g, '');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));
    res.send(csvContent);
  } catch (error) {
    console.error('Error exportando CSV:', error.message);
    res.status(500).json({ error: 'Error al exportar: ' + error.message });
  }
});

// Actualizar el estado de contacto de un lead
router.patch('/:id/contacto', async (req, res) => {
  try {
    const { id } = req.params;
    const { contactoEstado } = req.body;

    const lead = await prisma.lead.update({
      where: { id: parseInt(id) },
      data: { contactoEstado }
    });

    res.json(lead);
  } catch (error) {
    console.error('Error actualizando estado de contacto:', error.message);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// Actualizar el pipelineState de un lead (ej: SELECTED, CONTACTING, REPLIED...)
router.patch('/:id/pipeline', async (req, res) => {
  try {
    const { id } = req.params;
    const { pipelineState } = req.body;

    const lead = await prisma.lead.update({
      where: { id: parseInt(id) },
      data: { pipelineState }
    });

    res.json(lead);
  } catch (error) {
    console.error('Error actualizando pipelineState:', error.message);
    res.status(500).json({ error: 'Error al actualizar pipelineState' });
  }
});

// Obtener leads para el pipeline
router.get('/pipeline', async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      where: {
        pipelineState: {
          in: ['REPLIED', 'INTERESTED', 'FOLLOW_UP', 'NOT_INTERESTED', 'DISCARDED']
        }
      },
      include: {
        mensajes: {
          orderBy: { enviadoEn: 'desc' },
          take: 1
        }
      },
      orderBy: { id: 'desc' }
    });
    res.json(leads);
  } catch (error) {
    console.error('Error obteniendo leads de pipeline:', error.message);
    res.status(500).json({ error: 'Error al obtener leads del pipeline' });
  }
});

// Obtener conteo de leads por pipelineState
router.get('/pipeline-stats', async (req, res) => {
  try {
    const groups = await prisma.lead.groupBy({
      by: ['pipelineState'],
      where: { status: { not: 'discarded' } },
      _count: { _all: true }
    });

    const result = groups.reduce((acc, g) => {
      acc[g.pipelineState] = g._count._all;
      return acc;
    }, {});

    res.json(result);
  } catch (error) {
    console.error('Error obteniendo pipeline stats:', error.message);
    res.status(500).json({ error: 'Error al obtener pipeline stats' });
  }
});

module.exports = router;
