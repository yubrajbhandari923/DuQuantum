import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tutor } from './server/tutor';

// three and the React/R3F stack in their own cached chunks; the game code changes more often than they do
export default defineConfig({
  plugins: [react(), tutor()],
  build: { rollupOptions: { output: { manualChunks: { three: ['three'], r3f: ['@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing'], react: ['react', 'react-dom', 'zustand'] } } } },
});
