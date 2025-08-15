#!/bin/bash

echo "Setting up Prisma..."

# Clean install
echo "Cleaning previous installation..."
rm -rf node_modules
rm -f pnpm-lock.yaml package-lock.json

# Install dependencies
echo "Installing dependencies..."
npm install

# Install Prisma
echo "Installing Prisma..."
npm install @prisma/client prisma

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Start database
echo "Starting database..."
docker compose up -d db

# Wait for database
echo "Waiting for database to be ready..."
sleep 10

# Create shadow database manually
echo "Creating shadow database..."
docker compose exec -T db psql -U app_user -d waterbottle -c "CREATE DATABASE waterbottle_shadow;" || echo "Shadow database already exists"

# Run migration
echo "Running migration..."
docker compose run --rm -e MIGRATION_NAME=add_customer_status_rating_credit migrate

echo "Prisma setup complete!"
echo "You can now start your application with: npm run dev"