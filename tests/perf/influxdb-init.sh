#!/bin/bash
# InfluxDB initialization script for Atlas Sphere TPS tracking

# Wait for InfluxDB to be ready
until curl -f http://localhost:8086/health; do
  echo "Waiting for InfluxDB..."
  sleep 2
done

echo "InfluxDB is ready, initializing..."

# Create database if it doesn't exist
influx config create --config-name config \
  --host-url http://localhost:8086 \
  --org atlas-sphere \
  --token atlas-sphere-key \
  --active

# Create bucket for TPS data
influx bucket create -n atlas_sphere_tps --retention 30d 2>/dev/null || echo "Bucket may already exist"

echo "InfluxDB initialized successfully"
