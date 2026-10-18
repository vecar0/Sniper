import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      // index.html = 아케이드 웨이브 모드(메인), classic.html = 정밀 저격 작전(기존)
      input: { main: 'index.html', classic: 'classic.html' },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
} as never);
