#!/bin/bash

# バックアップ機能の動作確認スクリプト

echo "=== バックアップ機能の動作確認 ==="
echo ""

# 最新のデプロイURL
DEPLOY_URL="https://rakupochi-kintai-9yve3gw97-aims-projects-264acc6a.vercel.app"

echo "1. デプロイURL: $DEPLOY_URL"
echo ""

# CRON_SECRETの確認
echo "2. CRON_SECRETの確認"
echo "   Vercelダッシュボードで設定したCRON_SECRETを入力してください:"
read -s CRON_SECRET

if [ -z "$CRON_SECRET" ]; then
  echo "   ⚠️  CRON_SECRETが入力されていません"
  echo "   Vercelダッシュボードの環境変数からCRON_SECRETを取得してください"
  exit 1
fi

echo ""
echo "3. バックアップAPIを実行中..."
echo ""

# バックアップAPIを実行
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${DEPLOY_URL}/api/cron/backup" \
  -H "Authorization: Bearer ${CRON_SECRET}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTPステータスコード: $HTTP_CODE"
echo ""
echo "レスポンス:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

echo ""
echo "=== 確認完了 ==="
echo ""
echo "次のステップ:"
echo "1. Supabaseダッシュボード → Storage → backups バケットを確認"
echo "2. バックアップファイルが保存されているか確認"
echo "3. Vercelダッシュボード → Functions → Cron Jobs で実行履歴を確認"
