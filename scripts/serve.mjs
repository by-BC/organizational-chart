import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number.parseInt(process.env.PORT || '4173', 10);
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const target = resolve(root, `.${relative}`);
    if (target !== root && !target.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end('Acesso negado');
      return;
    }
    if (!(await stat(target)).isFile()) throw new Error('not-file');
    response.writeHead(200, { 'Content-Type': mime[extname(target)] || 'application/octet-stream' });
    response.end(await readFile(target));
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Arquivo não encontrado');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Organograma disponível em http://127.0.0.1:${port}`);
});
