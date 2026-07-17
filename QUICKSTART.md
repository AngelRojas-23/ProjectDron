# Streaming-Dron — Guía de inicio rápido

## Requisitos

- Node.js >= 18
- pnpm >= 8
- Docker + Docker Compose
- Git

## 1. Clonar e instalar

```bash
git clone https://github.com/AngelRojas-23/ProjectDron.git
cd ProjectDron
pnpm install
```

## 2. Configurar entorno

```bash
cp .env.example .env
# Editar .env si es necesario (los defaults funcionan para desarrollo local)
```

## 3. Iniciar servicios (Docker)

```bash
docker compose up -d
```

Esto levanta:
- **PostgreSQL 16** — base de datos principal
- **pgAdmin** — administrador de BD (http://localhost:5050)
- **mavlink2rest** — bridge MAVLink → WebSocket
- **MediaMTX** — servidor RTMP → HLS
- **FFmpeg simulator** — genera video de prueba (testsrc)

## 4. Migrar base de datos

```bash
pnpm --filter backend db:migrate
```

## 5. Iniciar desarrollo

```bash
pnpm dev
```

Esto corre en paralelo:
- **Backend API** → http://localhost:3000
- **Streaming server** → http://localhost:3001
- **Frontend** → http://localhost:5173

## 6. Probar

Abre http://localhost:5173, regístrate, y verás:
- Video de prueba del FFmpeg simulator
- Overlay OSD con telemetría simulada
- Dashboard con selector de drones

---

## Comandos útiles

| Comando | Qué hace |
|---------|----------|
| `pnpm test` | Corre todos los tests |
| `pnpm build` | Compila todos los paquetes |
| `pnpm lint` | TypeScript check estricto |
| `docker compose logs -f` | Logs de servicios Docker |
| `docker compose down` | Detiene servicios Docker |

## Estructura del proyecto

```
packages/
  backend/     — Fastify API (auth, health, Prisma)
  streaming/   — Socket.io + MAVLink bridge
  frontend/    — React + Vite + hls.js
  shared/      — Tipos TypeScript compartidos
```
