#!/bin/bash
# データベースマイグレーション実行スクリプト

echo "データベースマイグレーションを実行します..."
echo ""

# 本番環境のDATABASE_URLを使用
if [ -f .env.production ]; then
    export DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2 | tr -d '"')
    echo "本番環境のDATABASE_URLを使用します"
else
    echo "エラー: .env.production が見つかりません"
    echo "以下のコマンドを実行してください:"
    echo "  vercel env pull .env.production"
    exit 1
fi

# Prismaマイグレーションを実行
echo "マイグレーションを実行中..."
npx prisma migrate deploy

echo ""
echo "完了しました！"


