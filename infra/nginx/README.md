# infra/nginx

Reverse proxy de produção: roteia `/api/*` (e `/health`, `/ready`) para `apps/api` e todo o resto
para `apps/admin` (Next.js), atrás de um único host/porta. FASE 13 do roadmap.

## Design

- `nginx.conf` — dois `upstream` (`api_upstream`/`admin_upstream`, resolvidos pelos nomes de
  serviço do Docker Compose, `api`/`admin`), roteamento por prefixo de path, headers de segurança
  básicos (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`).
- **TLS termination fica de fora de propósito.** Não existe um jeito "genérico" correto de gerar
  certificados de produção sem saber o domínio/ambiente real de deploy — fabricar um certificado
  autoassinado aqui só passaria uma falsa sensação de segurança. Em produção, use um dos dois
  padrões usuais: (a) um provedor de certificado automático na frente deste nginx (Let's Encrypt via
  certbot, ou um load balancer/CDN gerenciado que já termina TLS antes de chegar aqui) — nesse caso
  este nginx só escuta HTTP/80 internamente, exatamente como está; ou (b) montar certificados reais
  em `/etc/nginx/certs` e adicionar um `server { listen 443 ssl; ... }` a este `nginx.conf`.
- `/api/*` é repassado **sem reescrever o path** — `apps/api` já serve tudo sob `/api/v1` (prefixo
  global do NestJS, `app.setGlobalPrefix` em `src/main.ts`), então `proxy_pass http://api_upstream;`
  (sem sufixo de path) preserva a URI original corretamente.

## Como testar localmente

```bash
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml \
  --env-file infra/docker/.env.prod up -d --build nginx
curl http://localhost/health
curl http://localhost/api/v1/instruments
```

## O que foi verificado nesta sandbox

`nginx.conf` foi revisado manualmente (sintaxe, blocos `upstream`/`location`, headers). **Não foi
possível rodar `nginx -t` nem subir o container** — esta sandbox não tem Docker/nginx instalados.
Rode o `curl` acima no seu ambiente antes de expor isto publicamente.
