#!/bin/bash

# 環境変数の設定状況を確認するスクリプト

echo "=========================================="
echo "AI Kitchen Partner - 環境変数チェック"
echo "=========================================="
echo ""

# .env.localファイルの存在確認
if [ -f ".env.local" ]; then
  echo "✅ .env.local ファイルが存在します"
else
  echo "❌ .env.local ファイルが存在しません"
  echo "   .env.local.template を参考に作成してください"
  exit 1
fi

echo ""
echo "環境変数の設定状況:"
echo "----------------------------------------"

# 各環境変数のチェック
check_var() {
  local var_name=$1
  local var_value=$(grep "^${var_name}=" .env.local 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'")
  
  if [ -z "$var_value" ] || [[ "$var_value" == *"your_"* ]] || [[ "$var_value" == *"YOUR-"* ]]; then
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
check_var "NEXT_PUBLIC_SUPABASE_URL"
check_var "NEXT_PUBLIC_SUPABASE_ANON_KEY"
check_var "OPENAI_API_KEY"

echo ""
echo "=========================================="
echo "チェック完了"
echo "=========================================="
echo ""
echo "すべての環境変数が設定されている場合、次を実行してください:"
echo "  npm run dev"
echo ""







