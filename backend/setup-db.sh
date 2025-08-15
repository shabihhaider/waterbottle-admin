#!/bin/bash

# Start database
echo "Starting PostgreSQL database..."
docker compose up -d db

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 10

# Create shadow database
echo "Creating shadow database..."
docker compose exec -T db createdb -U app_user waterbottle_shadow || echo "Shadow database already exists"

# Run migrations
echo "Running Prisma migrations..."
docker compose run --rm -e MIGRATION_NAME=add_customer_status_rating_credit migrate

echo "Database setup complete!"