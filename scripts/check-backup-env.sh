#!/bin/bash

# バックアップ機能の環境変数チェックスクリプト

echo "=========================================="
echo "バックアップ機能 - 環境変数チェック"
echo "=========================================="
echo ""

# .env.localファイルの存在確認
if [ -f ".env.local" ]; then
  echo "✅ .env.local ファイルが存在します"
else
  echo "⚠️  .env.local ファイルが存在しません（ローカル開発環境の場合）"
  echo "   Vercelの環境変数が設定されているか確認してください"
fi

echo ""
echo "バックアップ関連の環境変数チェック:"
echo "----------------------------------------"

# 各環境変数のチェック
check_var() {
  local var_name=$1
  local var_value=""
  
  # .env.localから読み取り（存在する場合）
  if [ -f ".env.local" ]; then
    var_value=$(grep "^${var_name}=" .env.local 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'")
  fi
  
  # 環境変数からも読み取り（Vercel環境など）
  if [ -z "$var_value" ]; then
    var_value="${!var_name}"
  fi
  
  if [ -z "$var_value" ] || [[ "$var_value" == *"your_"* ]] || [[ "$var_value" == *"YOUR-"* ]] || [[ "$var_value" == *"your-"* ]]; then
    echo "❌ ${var_name}: 未設定またはテンプレート値のまま"
    return 1
  else
    # 値の一部を表示（セキュリティのため）
    local masked_value=$(echo "$var_value" | sed 's/\(.\{10\}\).*/\1.../')
    echo "✅ ${var_name}: ${masked_value}"
    return 0
  fi
}

# チェック対象の環境変数
check_backup_storage=0
check_supabase_url=0
check_service_key=0
check_cron_secret=0

if check_var "BACKUP_STORAGE"; then
  check_backup_storage=1
fi

if check_var "NEXT_PUBLIC_SUPABASE_URL"; then
  check_supabase_url=1
fi

if check_var "SUPABASE_SERVICE_ROLE_KEY"; then
  check_service_key=1
fi

if check_var "CRON_SECRET"; then
  check_cron_secret=1
fi

echo ""
echo "=========================================="
echo "チェック結果"
echo "=========================================="

if [ $check_backup_storage -eq 1 ] && [ $check_supabase_url -eq 1 ] && [ $check_service_key -eq 1 ] && [ $check_cron_secret -eq 1 ]; then
  echo "✅ すべての必須環境変数が設定されています"
  echo ""
  echo "次のステップ:"
  echo "  1. Supabase Storageに 'backups' バケットが作成されているか確認"
  echo "  2. バックアップAPIをテスト: scripts/test-backup.sh"
  exit 0
else
  echo "❌ 一部の環境変数が未設定です"
  echo ""
  echo "設定が必要な環境変数:"
  [ $check_backup_storage -eq 0 ] && echo "  - BACKUP_STORAGE=supabase"
  [ $check_supabase_url -eq 0 ] && echo "  - NEXT_PUBLIC_SUPABASE_URL"
  [ $check_service_key -eq 0 ] && echo "  - SUPABASE_SERVICE_ROLE_KEY"
  [ $check_cron_secret -eq 0 ] && echo "  - CRON_SECRET"
  echo ""
  echo "詳細は BACKUP_SETUP.md を参照してください"
  exit 1
fi
