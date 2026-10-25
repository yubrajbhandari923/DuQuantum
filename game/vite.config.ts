import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tutor } from './server/tutor';

export default defineConfig({ plugins: [react(), tutor()] });
