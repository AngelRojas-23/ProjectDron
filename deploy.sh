#!/usr/bin/env bash
# Script de deploy para Streaming-Dron
# Uso: ./deploy.sh <server-ip> [domain]
# Ejemplo: ./deploy.sh 123.456.789.0 dron.midominio.com

set -euo pipefail

SERVER_IP="${1:?Uso: ./deploy.sh <server-ip> [domain]}"
DOMAIN="${2:-}"

echo "🚀 Deploy Streaming-Dron a $SERVER_IP"

# 1. Conectar y preparar servidor
ssh "root@$SERVER_IP" bash -s << 'REMOTE'
  set -e

  echo "📦 Instalando dependencias..."
  apt-get update -qq
  apt-get install -y -qq curl git docker.io docker-compose-v2 nodejs npm

  # Node.js 20
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs

  # pnpm
  npm install -g pnpm

  echo "📁 Clonando repositorio..."
  git clone https://github.com/AngelRojas-23/ProjectDron.git /opt/streaming-dron
  cd /opt/streaming-dron

  echo "🔧 Configurando entorno..."
  cp .env.example .env

  # Generar JWT_SECRET seguro
  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s/your-secret-key-here-change-in-production/$JWT_SECRET/" .env

  echo "🐳 Iniciando servicios Docker..."
  docker compose up -d

  echo "⏳ Esperando PostgreSQL..."
  until docker compose exec postgres pg_isready -U postgres; do
    sleep 1
  done

  echo "📦 Instalando dependencias Node..."
  pnpm install --frozen-lockfile

  echo "🏗️  Compilando..."
  pnpm build

  echo "🗄️  Migrando base de datos..."
  pnpm --filter backend db:deploy

  echo "🔄 Iniciando aplicación..."
  # Usar PM2 para producción
  npm install -g pm2
  pm2 delete streaming-dron 2>/dev/null || true
  pm2 start pnpm --name streaming-dron -- dev
  pm2 save
REMOTE

# 2. Configurar dominio (opcional)
if [ -n "$DOMAIN" ]; then
  echo "🌐 Configurando dominio $DOMAIN..."
  ssh "root@$SERVER_IP" bash -s << REMOTE
    apt-get install -y -qq nginx certbot python3-certbot-nginx

    cat > /etc/nginx/sites-available/streaming-dron << 'NGINX'
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /auth {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /hls {
        proxy_pass http://localhost:8888;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_buffering off;
        proxy_cache off;
    }
}
NGINX

    ln -sf /etc/nginx/sites-available/streaming-dron /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx

    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN"
REMOTE
fi

echo ""
echo "✅ Deploy completado!"
echo "   App:    http://$SERVER_IP:5173"
if [ -n "$DOMAIN" ]; then
  echo "   App:    https://$DOMAIN"
fi
echo "   Admin:  http://$SERVER_IP:5050"
echo ""
echo "Para ver logs: ssh root@$SERVER_IP 'pm2 logs streaming-dron'"
