import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base + hash routing: the build works from any path, including
// GitHub Pages at https://<owner>.github.io/<repo>/.
export default defineConfig({
  base: './',
  plugins: [react()],
})
