# backend/Dockerfile
FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copy the rest of the backend
COPY . .

# Generate Prisma Client at build time for faster start
RUN npx prisma generate

# Healthcheck (optional, Node 20 has fetch)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5050)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Entrypoint: migrate then start
RUN chmod +x ./docker-entrypoint.sh
ENV PORT=5050
EXPOSE 5050
CMD ["./docker-entrypoint.sh"]
