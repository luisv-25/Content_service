// Fusiona scripts y devDependencies de pruebas en TU package.json sin tocar lo demás (prom-client, etc.).
// Uso (dentro de la carpeta del microservicio):  node aplicar-pruebas.js
const fs = require("fs");
const pj = JSON.parse(fs.readFileSync("package.json", "utf8"));
const add = JSON.parse(fs.readFileSync("pruebas.package.json", "utf8"));
pj.scripts = { ...pj.scripts, ...add.scripts };
pj.devDependencies = { ...(pj.devDependencies || {}), ...add.devDependencies };
fs.writeFileSync("package.json", JSON.stringify(pj, null, 2) + "\n");
console.log("package.json actualizado: ahora ejecuta  npm install  y  npm test");
