import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const api = 'http://127.0.0.1:8730'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': api, '/projects': api } },
})
