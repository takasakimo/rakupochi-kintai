#!/bin/bash

# バックアップAPIのテストスクリプト

echo "=========================================="
echo "バックアップAPI - テスト実行"
echo "=========================================="
echo ""

# 環境変数の読み込み
if [ -f ".env.local" ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

# 必須環境変数の確認
if [ -z "$CRON_SECRET" ]; then
  echo "⚠️  CRON_SECRET が .env.local に見つかりません"
  echo ""
  echo "Vercel CLIから環境変数を取得しますか？ (y/n)"
  read -p "> " answer
  
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    echo ""
    echo "Vercel CLIから環境変数を取得しています..."
    if command -v vercel &> /dev/null; then
      vercel env pull .env.local --yes 2>/dev/null || vercel env pull .env.local
      if [ -f ".env.local" ]; then
        export $(grep -v '^#' .env.local | xargs)
        echo "✅ 環境変数を取得しました"
      else
        echo "❌ 環境変数の取得に失敗しました"
        exit 1
      fi
    else
      echo "❌ Vercel CLIがインストールされていません"
      echo "   インストール: npm i -g vercel"
      echo ""
      echo "または、Vercelダッシュボードから CRON_SECRET を取得して、"
      echo ".env.local に以下を追加してください:"
      echo "CRON_SECRET=your-cron-secret-value"
      exit 1
    fi
  else
    echo ""
    echo "Vercelダッシュボードから CRON_SECRET を取得して、"
    echo ".env.local に以下を追加してください:"
    echo "CRON_SECRET=your-cron-secret-value"
    exit 1
  fi
fi

# 再度確認
if [ -z "$CRON_SECRET" ]; then
  echo "❌ CRON_SECRET が設定されていません"
  exit 1
fi

# デプロイURLの確認
# 1. 環境変数から取得を試みる
if [ -n "$VERCEL_URL" ]; then
  DEPLOY_URL="$VERCEL_URL"
elif [ -n "$NEXT_PUBLIC_VERCEL_URL" ]; then
  DEPLOY_URL="$NEXT_PUBLIC_VERCEL_URL"
elif [ -n "$NEXTAUTH_URL" ]; then
  # NEXTAUTH_URLから取得（通常はデプロイURLと同じ）
  DEPLOY_URL="$NEXTAUTH_URL"
fi

# 2. まだ取得できていない場合、ユーザーに入力を求める
if [ -z "$DEPLOY_URL" ]; then
  echo "⚠️  デプロイURLが設定されていません"
  echo ""
  echo "既知のデプロイURLを使用しますか？ (y/n)"
  echo "  https://rakupochi-kintai-9yve3gw97-aims-projects-264acc6a.vercel.app"
  read -p "> " answer
  
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    DEPLOY_URL="https://rakupochi-kintai-9yve3gw97-aims-projects-264acc6a.vercel.app"
    echo "✅ デフォルトURLを使用します: $DEPLOY_URL"
  else
    read -p "VercelのデプロイURLを入力してください（例: https://rakupochi-kintai-xxx.vercel.app）: " DEPLOY_URL
    if [ -z "$DEPLOY_URL" ]; then
      echo "❌ URLが入力されませんでした"
      exit 1
    fi
  fi
fi

# http:// または https:// が含まれていない場合は追加
case "$DEPLOY_URL" in
  http://*|https://*)
    # すでにプロトコルが含まれている
    ;;
  *)
    DEPLOY_URL="https://${DEPLOY_URL}"
    ;;
esac

echo "デプロイURL: $DEPLOY_URL"
echo ""

# バックアップAPIのエンドポイント
BACKUP_ENDPOINT="${DEPLOY_URL}/api/cron/backup"

echo "バックアップAPIを呼び出しています..."
echo "エンドポイント: $BACKUP_ENDPOINT"
echo ""

# curlでAPIを呼び出し
# 注意: デプロイメント保護が有効な場合、外部からのアクセスはブロックされます
# 実際のCronジョブからの自動実行は問題ありません（Vercelが自動的に認証を処理）
echo "APIを呼び出しています..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BACKUP_ENDPOINT" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  2>&1)

# HTTPステータスコードとレスポンスボディを分離
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# デプロイメント保護が有効な場合、HTMLレスポンスが返される
if echo "$BODY" | grep -q "<!doctype html\|<html"; then
  echo ""
  echo "⚠️  デプロイメント保護が有効になっているため、外部からのアクセスがブロックされています。"
  echo ""
  echo "これは正常な動作です。実際のCronジョブからの自動実行は問題ありません。"
  echo ""
  echo "バックアップの動作確認方法:"
  echo "1. Vercelダッシュボード → Deployments → Functions → Cron Jobs"
  echo "2. /api/cron/backup の実行履歴を確認"
  echo "3. 次回の自動実行（毎日11時）を待つ"
  echo "4. Supabase Storage → backups バケットでファイルを確認"
  echo ""
  echo "手動でテストする場合は、Vercelダッシュボードでデプロイメント保護を一時的に無効にするか、"
  echo "Vercel CLIを使用してローカルからテストしてください。"
  echo ""
  HTTP_CODE="401"
fi

echo "=========================================="
echo "レスポンス"
echo "=========================================="
echo "HTTPステータスコード: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ バックアップが成功しました！"
  echo ""
  echo "レスポンス内容:"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""
  
  # レスポンスから情報を抽出
  STORAGE_PROVIDER=$(echo "$BODY" | jq -r '.storage.provider' 2>/dev/null)
  FILE_NAME=$(echo "$BODY" | jq -r '.storage.fileName' 2>/dev/null)
  BACKUP_SIZE=$(echo "$BODY" | jq -r '.backupSize' 2>/dev/null)
  
  if [ "$STORAGE_PROVIDER" = "supabase" ] && [ "$FILE_NAME" != "null" ]; then
    echo "=========================================="
    echo "次のステップ"
    echo "=========================================="
    echo "1. Supabaseダッシュボードで確認:"
    echo "   Storage → backups バケット"
    echo "   ファイル名: $FILE_NAME"
    echo ""
    echo "2. バックアップサイズ: $BACKUP_SIZE"
    echo ""
    echo "3. バックアップファイルの内容を確認してください"
  fi
elif [ "$HTTP_CODE" = "401" ]; then
  echo "❌ 認証エラー"
  echo "   CRON_SECRET が正しく設定されているか確認してください"
  echo ""
  echo "レスポンス内容:"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  exit 1
elif [ "$HTTP_CODE" = "500" ]; then
  echo "❌ サーバーエラー"
  echo "   Vercelのログを確認してください"
  echo ""
  echo "レスポンス内容:"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  exit 1
else
  echo "❌ エラーが発生しました"
  echo ""
  echo "レスポンス内容:"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  exit 1
fi

echo ""
echo "=========================================="
echo "テスト完了"
echo "=========================================="
