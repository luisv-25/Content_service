// Se ejecuta antes de cada archivo de prueba (jest "setupFiles"): apunta el servicio a la
// base de datos de PRUEBAS. En GitHub Actions la base la crea el contenedor de PostgreSQL del
// workflow; en local basta con tener PostgreSQL y (si hace falta) definir TEST_DB_* .
const pkg = require("../../package.json");

process.env.TZ = "UTC"; // Postgres corre en UTC; evita desfases con columnas timestamp sin zona
process.env.NODE_ENV = "test";
process.env.DB_HOST = process.env.TEST_DB_HOST || "localhost";
process.env.DB_PORT = process.env.TEST_DB_PORT || "5432";
process.env.DB_USER = process.env.TEST_DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || "postgres";
process.env.DB_NAME = process.env.TEST_DB_NAME || `${String(pkg.name).replace(/-/g, "_")}_test`;
process.env.DB_SSL = "false";
process.env.DB_SYNCHRONIZE = "true";
process.env.JWT_SECRET = "test_jwt_secret";
