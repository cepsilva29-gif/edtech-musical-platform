import { config } from 'dotenv';
import { resolve } from 'node:path';

// Carrega apps/api/.env.test.local (nunca commitado - ver .env.test.example) antes de qualquer
// teste de integracao rodar, para que AppModule/env.validation vejam o DATABASE_URL de teste.
config({ path: resolve(__dirname, '..', '.env.test.local') });
