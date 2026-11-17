# content-service

Material de apoyo por sesión (archivos en Supabase Storage) y enlaces compartidos.

Parte de **EduConecta** (plataforma de tutorías, arquitectura de microservicios). Stack: NestJS · TypeORM · PostgreSQL · RabbitMQ.

## Requisitos
- Node.js 20+
- PostgreSQL 14+ (local o Neon)

## Puesta en marcha
```bash
cd content-service
cp .env.example .env   # completar valores
npm install
npm run start:dev      # desarrollo
npm run build && npm start   # producción
```
El servicio escucha en `PORT` (por defecto 5439). Salud: `GET /health` y `GET /ready`; métricas: `GET /metrics`.

## Variables de entorno
Ver `.env.example`. Todos los servicios que validan JWT deben usar el **mismo** `JWT_SECRET` (y el gateway también).

## Endpoints
| Método | Ruta |
|---|---|
| POST | `/api/v1/files` |
| GET | `/api/v1/files` |
| GET | `/api/v1/files/:id` |
| GET | `/api/v1/files/:id/download` |
| DELETE | `/api/v1/files/:id` |
| POST | `/api/v1/files/:fileId/shared-links` |
| GET | `/api/v1/files/:fileId/shared-links` |
| GET | `/api/v1/shared-links/:token` |
| DELETE | `/api/v1/shared-links/expired` |

## Pruebas
```bash
npm run test:unit
npm run test:integration   # requiere PostgreSQL (TEST_DB_PASSWORD)
```
CI/CD: GitHub Actions (`.github/workflows/ci.yml` y `deploy.yml`, despliegue a Render por Deploy Hook).
