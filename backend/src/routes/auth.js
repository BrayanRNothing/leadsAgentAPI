const express = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // En producción, usar bcrypt para verificar contraseña
  // Por reglas del usuario, brayan / 123 es el único de momento
  if (username === 'brayan' && password === '123') {
    const token = jwt.sign({ username }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '1d',
    });
    return res.json({ token, username });
  }

  // Verificación en BD por si agregan más en el futuro
  const user = await prisma.usuario.findUnique({ where: { username } });
  if (user && user.password === password) {
    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '1d',
    });
    return res.json({ token, username: user.username });
  }

  return res.status(401).json({ error: 'Credenciales inválidas' });
});

module.exports = router;
