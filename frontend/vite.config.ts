import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API base URL lives in src/api/client.ts (via VITE_API_URL); requests go
// straight to the backend, so no dev-server proxy is needed here.
export default defineConfig({
  plugins: [react()],
});
