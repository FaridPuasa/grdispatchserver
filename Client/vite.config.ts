import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
        configure: (proxy: any) => { // cast to any
          proxy.on('error', (err: any, req: any, res: any) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq: any, req: any, res: any) => {
            console.log('Sending request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes: any, req: any, res: any) => {
            console.log('Received response:', proxyRes.statusCode, req.url);
          });
        }
      }
    }
  }
})
