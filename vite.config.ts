import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /**
     * M7.1：把 /api 转发给本地最小 Node server（`npm run dev:api`）。
     *
     * 有了这条代理，浏览器侧发的永远是**同源相对路径** `/api/...`，
     * 前端代码里因此不会出现 127.0.0.1:8787、更不会出现 provider 域名。
     * 开发态的请求形状与生产（同一个进程同时托管 dist 与 /api）保持一致。
     *
     * 只代理 /api 这一个前缀，其余请求仍然由 Vite 自己处理。
     */
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
