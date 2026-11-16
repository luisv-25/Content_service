import { INestApplication } from "@nestjs/common";
import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";
import { DataSource } from "typeorm";

// Métricas para Prometheus (sección de observabilidad). Este mismo archivo se
// copia sin cambios a los 9 microservicios; lo único que varía es el nombre
// del servicio que se pasa en main.ts. Expone GET /metrics (sin el prefijo
// /api/v1, que es lo que Prometheus consulta por defecto) con:
//   - métricas del proceso Node: CPU, memoria, event loop, GC (prefijo "educonecta_")
//   - http_requests_total{service,method,route,status}: cuántas peticiones, por ruta y código
//   - http_request_duration_seconds{...}: histograma de latencia por ruta
// "route" usa la ruta con parámetros (/api/v1/users/:id), no la URL real, para
// que no se creen series infinitas.
//
// Este archivo también expone la salud del servicio (también fuera de /api/v1):
//   GET /health  -> "vivo": el proceso responde (no toca la base de datos).
//   GET /ready   -> "listo": además hace SELECT 1 a su base de datos; 503 si no hay conexión.
export function setupMetrics(app: INestApplication, serviceName: string) {
  const registry = new Registry();
  registry.setDefaultLabels({ service: serviceName });
  collectDefaultMetrics({ register: registry, prefix: "educonecta_" });

  const httpRequests = new Counter({
    name: "http_requests_total",
    help: "Total de peticiones HTTP",
    labelNames: ["method", "route", "status"],
    registers: [registry],
  });
  const httpDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duración de las peticiones HTTP en segundos",
    labelNames: ["method", "route", "status"],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
    registers: [registry],
  });

  const http = app.getHttpAdapter();

  app.use((req: any, res: any, next: () => void) => {
    if (req.path === "/metrics") return next(); // no medirse a sí mismo
    const end = httpDuration.startTimer();
    res.on("finish", () => {
      const route = req.route?.path ? `${req.baseUrl || ""}${req.route.path}` : "no_encontrada";
      const labels = { method: req.method, route, status: String(res.statusCode) };
      httpRequests.inc(labels);
      end(labels);
    });
    next();
  });

  http.get("/health", (_req: any, res: any) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "ok", service: serviceName, uptime: Math.round(process.uptime()) }));
  });

  http.get("/ready", async (_req: any, res: any) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const ds = app.get(DataSource, { strict: false });
      await ds.query("SELECT 1");
      res.end(JSON.stringify({ status: "ready", service: serviceName, database: "up" }));
    } catch (err: any) {
      res.statusCode = 503;
      res.end(JSON.stringify({ status: "not_ready", service: serviceName, database: "down" }));
    }
  });

  http.get("/metrics", async (_req: any, res: any) => {
    res.setHeader("Content-Type", registry.contentType);
    res.end(await registry.metrics());
  });
}
