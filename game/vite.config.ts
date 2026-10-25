import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tutor } from './server/tutor';

// Three and the React/R3F stack in their own cached chunks; game code changes more often.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tutor()],
  build: { rollupOptions: { output: { manualChunks: { three: ['three'], r3f: ['@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing'], react: ['react', 'react-dom', 'zustand'] } } } },
});
