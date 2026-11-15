import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  plugins:[react(),tailwindcss()],
  resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
  define:{
    'process.env.NEXT_PUBLIC_HOSPITAL_AUTH_EMULATOR':JSON.stringify('0'),
  },
  build:{outDir:'dist',emptyOutDir:true,assetsDir:'assets',sourcemap:false},
  server:{port:5173,strictPort:true},
});
