import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' gör att bygget fungerar på GitHub Pages oavsett repo-namn.
export default defineConfig({
  base: './',
  plugins: [react()],
})
