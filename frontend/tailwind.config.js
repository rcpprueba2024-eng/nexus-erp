/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/OrdenTrabajo.jsx',
    './src/pages/NuevaOrden.jsx',
    './src/pages/Ordenes.jsx',
    './src/pages/Clientes.jsx',
    './src/pages/FacturarOts.jsx',
    './src/pages/EquiposListos.jsx',
    './src/components/orden/**/*.{js,jsx}',
    './src/components/OrdenPreview.jsx',
    './src/components/ReciboPreview.jsx',
  ],
  corePlugins: {
    preflight: false, // no tocar el reset/estilos del resto del sistema
  },
  important: '.orden-tw', // todas las utilidades quedan encapsuladas bajo este contenedor
  theme: {
    extend: {
      colors: {
        // Puente hacia el sistema de temas del resto de la app (ver
        // src/index.css): estas páginas usan Tailwind con clases fijas, así
        // que en vez de slate-*/white/brand-* fijos, apuntan a las mismas
        // variables CSS que cambian con el tema (Configuración > Apariencia).
        // brand-* numérico se conserva por compatibilidad con clases viejas.
        brand: {
          DEFAULT: 'var(--accent)',
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#3730a3',
        },
        canvas: 'var(--bg)',
        surface: 'var(--panel)',
        subtle: 'var(--panel-2)',
        tint: 'var(--accent-bg)',
        ink: 'var(--text-h)',
        muted: 'var(--text)',
        line: 'var(--border)',
      },
      boxShadow: {
        card: 'var(--shadow-sm)',
        pop: 'var(--shadow-md)',
      },
    },
  },
  plugins: [],
}
