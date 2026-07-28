import React, { useState } from 'react';
import axios from 'axios';
import { User, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginSquare({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (username === 'brayan' && password === '123') {
        onLogin(username);
      } else {
        setError('Credenciales inválidas');
      }
    } catch (err) {
      setError('Credenciales inválidas');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="w-full h-full flex flex-col justify-center items-center"
    >
      <motion.h2 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-2xl font-bold text-textMain mb-8"
      >
        Ingresar
      </motion.h2>
      
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col space-y-6">
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative"
        >
          <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-textLight" size={20} />
          <motion.input 
            whileFocus={{ scale: 1.02 }}
            type="text" 
            placeholder="Usuario"
            className="neu-input w-full pl-12"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </motion.div>

        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="relative"
        >
          <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-textLight" size={20} />
          <motion.input 
            whileFocus={{ scale: 1.02 }}
            type="password" 
            placeholder="Contraseña"
            className="neu-input w-full pl-12"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </motion.div>

        {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-sm font-semibold text-center">{error}</motion.p>}

        <motion.button 
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          type="submit" 
          className="neu-button py-3 mt-4"
        >
          Entrar
        </motion.button>
      </form>
    </motion.div>
  );
}
