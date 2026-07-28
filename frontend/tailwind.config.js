/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Colores formales para el fondo y elementos
        background: '#e0e5ec',
        textMain: '#4a5568',
        textLight: '#a0aec0',
        primary: '#3182ce',
      },
      boxShadow: {
        // Sombras Neumórficas (una clara arriba a la izquierda, una oscura abajo a la derecha)
        'neu-flat': '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)',
        'neu-pressed': 'inset 6px 6px 10px 0 rgba(163, 177, 198, 0.7), inset -6px -6px 10px 0 rgba(255, 255, 255, 0.8)',
        'neu-hover': '12px 12px 20px rgb(163,177,198,0.7), -12px -12px 20px rgba(255,255,255, 0.6)',
      }
    },
  },
  plugins: [],
}
