#!/bin/bash
# 本番環境のデータベースマイグレーション実行スクリプト
# 使用方法: DATABASE_URL="your-production-db-url" ./scripts/migrate-production.sh

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "Running migration: make_shift_times_optional.sql"
psql "$DATABASE_URL" -f prisma/migrations/make_shift_times_optional.sql

if [ $? -eq 0 ]; then
  echo "Migration completed successfully"
else
  echo "Migration failed"
  exit 1
fi

