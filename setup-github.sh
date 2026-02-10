#!/bin/bash

# GitHubリポジトリ連携セットアップスクリプト

echo "=========================================="
echo "GitHubリポジトリ連携セットアップ"
echo "=========================================="
echo ""

# GitHubユーザー名を確認
echo "GitHubのユーザー名を入力してください（例: takasakimo）:"
read -p "> " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
  echo "❌ ユーザー名が入力されませんでした"
  exit 1
fi

REPO_NAME="rakupochi-kintai"
GITHUB_URL="https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"

echo ""
echo "設定内容:"
echo "  ユーザー名: $GITHUB_USERNAME"
echo "  リポジトリ名: $REPO_NAME"
echo "  GitHub URL: $GITHUB_URL"
echo ""

# 既存のリモートを確認
if git remote get-url origin 2>/dev/null; then
  echo "⚠️  既存のリモート 'origin' が見つかりました"
  CURRENT_URL=$(git remote get-url origin)
  echo "  現在のURL: $CURRENT_URL"
  echo ""
  read -p "上書きしますか？ (y/n): " answer
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    git remote remove origin
    echo "✅ 既存のリモートを削除しました"
  else
    echo "❌ キャンセルしました"
    exit 1
  fi
fi

# GitHubリポジトリの存在確認
echo ""
echo "GitHubリポジトリが作成されているか確認しています..."
if curl -s -o /dev/null -w "%{http_code}" "https://github.com/${GITHUB_USERNAME}/${REPO_NAME}" | grep -q "200"; then
  echo "✅ GitHubリポジトリが存在します"
else
  echo "⚠️  GitHubリポジトリが見つかりませんでした"
  echo ""
  echo "以下の手順でGitHubリポジトリを作成してください:"
  echo "1. https://github.com/new にアクセス"
  echo "2. リポジトリ名: $REPO_NAME"
  echo "3. 公開設定を選択（Private または Public）"
  echo "4. 「Create repository」をクリック"
  echo ""
  read -p "GitHubリポジトリを作成しましたか？ (y/n): " answer
  if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
    echo "❌ GitHubリポジトリの作成が必要です"
    exit 1
  fi
fi

# リモートを追加
echo ""
echo "Gitリモートを追加しています..."
git remote add origin "$GITHUB_URL"

if [ $? -eq 0 ]; then
  echo "✅ リモートを追加しました"
else
  echo "❌ リモートの追加に失敗しました"
  exit 1
fi

# リモートの確認
echo ""
echo "リモート設定を確認:"
git remote -v

echo ""
echo "=========================================="
echo "次のステップ"
echo "=========================================="
echo ""
echo "1. 変更をコミット:"
echo "   git add ."
echo "   git commit -m \"Initial commit\""
echo ""
echo "2. GitHubにプッシュ:"
echo "   git push -u origin main"
echo ""
echo "3. Vercelダッシュボードで接続:"
echo "   - Settings → Git → Connect Git Repository"
echo "   - $REPO_NAME を選択"
echo ""
