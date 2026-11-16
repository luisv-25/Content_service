import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { Client } from "pg";

// Crea la base de pruebas si no existe y la deja VACÍA (esquema nuevo). TypeORM
// (synchronize) vuelve a crear las tablas al levantar la aplicación.
export async function resetDatabase(): Promise<void> {
  const base = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const admin = new Client({ ...base, database: "postgres" });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [process.env.DB_NAME]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
  await admin.end();

  const db = new Client({ ...base, database: process.env.DB_NAME });
  await db.connect();
  await db.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await db.end();
}

// Publicador de eventos FALSO: reemplaza al que habla con RabbitMQ. Guarda cada llamada
// "publishXxx(...)" en `calls` para poder verificar qué eventos se habrían emitido.
export function fakeEventsPublisher() {
  const calls: Array<{ event: string; args: any[] }> = [];
  const target: any = { calls };
  return new Proxy(target, {
    get: (t, prop) => {
      if (prop in t) return t[prop];
      if (typeof prop === "string" && prop.startsWith("publish")) {
        return (...args: any[]) => {
          calls.push({ event: prop, args });
        };
      }
      return undefined; // p. ej. onModuleInit: Nest no debe intentar conectarse a RabbitMQ
    },
  });
}

// Token JWT válido (mismo secreto que usan los guards de todos los servicios).
export function tokenFor(userId: string, role: "student" | "tutor" | "admin") {
  return new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: userId, role }, { expiresIn: "15m" });
}

// Levanta la aplicación COMPLETA (módulos reales + PostgreSQL real) con los proveedores que
// hablan con el exterior (RabbitMQ, otros microservicios, pasarelas) reemplazados.
export async function createTestApp(
  imports: any[],
  overrides: Array<{ provide: any; useValue: any }> = [],
): Promise<INestApplication> {
  await resetDatabase();
  let builder = Test.createTestingModule({ imports });
  for (const o of overrides) builder = builder.overrideProvider(o.provide).useValue(o.useValue);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("api/v1");
  await app.init();
  return app;
}
