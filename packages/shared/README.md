# packages/shared

Tipos e contratos de API (DTOs) compartilhados entre `apps/api`, `apps/admin` e `apps/mobile`,
evitando duplicação/divergência de tipos entre backend e clientes.

**Status:** populado na **FASE 10**, quando `apps/mobile` se tornou o primeiro consumidor real
desses tipos.

Cada arquivo espelha um domínio da API (mesmo agrupamento de `apps/api/src/`): `auth.ts`,
`catalog.ts` (instrumentos/cursos/módulos/aulas/materiais), `progress.ts`, `access-control.ts`,
`playback.ts`, `subscriptions.ts`, `payments.ts`, `live-sessions.ts`, além de `common.ts` (envelope
de resposta `{ success, data }` / `{ success: false, error }` e paginação).

**Importante:** todo campo `DateTime` do Prisma chega ao cliente como `string` ISO 8601 (a
serialização JSON padrão do Express/Nest converte `Date` para string) — por isso nenhum tipo aqui
usa `Date`, sempre `string`. Isso é responsabilidade do cliente reconstituir (`new Date(iso)`)
quando precisar operar sobre a data, não deste pacote.

Estes tipos são mantidos manualmente em sincronia com os DTOs/services reais de `apps/api` — não
há geração automática nesta fase (ex. `nestjs-zod`/OpenAPI codegen). Se um contrato de API mudar,
atualizar aqui também é responsabilidade do PR que mudou a API.
