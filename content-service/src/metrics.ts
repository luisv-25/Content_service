import { INestApplication } from "@nestjs/common";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

// Métricas para Prometheus (sección de observabilidad). Cada microservicio
// expone GET /metrics (fuera del prefijo /api/v1) con:
//   - métricas por defecto de Node (CPU, memoria, event loop, GC),
//   - http_requests_total{method,route,status_code},
//   - http_request_duration_seconds (histograma, para latencia p50/p95/p99).
// "route" es la ruta con parámetros (/api/v1/users/:id), no la URL real,
// para que no se multipliquen las series por cada id distinto.
// Si se define METRICS_TOKEN en el entorno, /metrics exige "Authorization:
// Bearer <token>" (Prometheus lo envía con `authorization` en su config).
export function setupMetrics(app: INestApplication) {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const httpRequests = new Counter({
    name: "http_requests_total",
    help: "Total de peticiones HTTP atendidas",
    labelNames: ["method", "route", "status_code"],
    registers: [registry],
  });
  const httpDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duración de las peticiones HTTP en segundos",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const adapter = app.getHttpAdapter();
  const server = adapter.getInstance();

  server.use((req: any, res: any, next: () => void) => {
    if (req.path === "/metrics") return next();
    const stopTimer = httpDuration.startTimer();
    res.on("finish", () => {
      const labels = {
        method: req.method,
        route: req.route?.path ?? "unmatched",
        status_code: String(res.statusCode),
      };
      httpRequests.inc(labels);
      stopTimer(labels);
    });
    next();
  });

  adapter.get("/metrics", async (req: any, res: any) => {
    const token = process.env.METRICS_TOKEN;
    if (token && req.headers["authorization"] !== `Bearer ${token}`) {
      res.status(401).send("unauthorized");
      return;
    }
    res.set("Content-Type", registry.contentType);
    res.end(await registry.metrics());
  });
}
