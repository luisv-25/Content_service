module.exports = async () => { process.env.TZ = "UTC"; }; // Postgres corre en UTC: evita desfases con columnas timestamp sin zona
