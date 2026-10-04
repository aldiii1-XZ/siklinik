# SIKLINIK — satu kontainer melayani frontend sekaligus API.
# Hasil akhir: satu alamat untuk seluruh aplikasi (cocok untuk demo ke dosen).
FROM node:24-slim

WORKDIR /app

# Playwright hanya dipakai untuk tes di mesin pengembang; jangan unduh
# browser-nya saat build (membuat image besar dan build lambat).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Dependensi frontend (termasuk alat build Vite/TypeScript).
COPY package*.json ./
RUN npm install

# Kode sumber, lalu build frontend -> /app/dist
COPY . .
RUN npm run build

# Dependensi server (hanya produksi).
WORKDIR /app/server
RUN npm install --omit=dev

ENV NODE_ENV=production
EXPOSE 3000

# Port diambil dari env PORT (Render/Railway mengisinya otomatis).
CMD ["node", "src/index.js"]
