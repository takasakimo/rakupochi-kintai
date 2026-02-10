#!/bin/bash

# GitHubリポジトリ作成とVercel連携の完全セットアップ

echo "=========================================="
echo "GitHubリポジトリ作成とVercel連携セットアップ"
echo "=========================================="
echo ""

GITHUB_USER="takasakimo"
REPO_NAME="rakupochi-kintai"
GITHUB_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo "設定内容:"
echo "  GitHubユーザー: $GITHUB_USER"
echo "  リポジトリ名: $REPO_NAME"
echo "  GitHub URL: $GITHUB_URL"
echo ""

# 既存のリモートを確認
if git remote get-url origin 2>/dev/null; then
  CURRENT_URL=$(git remote get-url origin)
  echo "既存のリモート 'origin' が見つかりました:"
  echo "  $CURRENT_URL"
  echo ""
  read -p "上書きしますか？ (y/n): " answer
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    git remote remove origin
    echo "✅ 既存のリモートを削除しました"
  else
    echo "⚠️  既存のリモートを保持します"
  fi
fi

# GitHubリポジトリの作成確認
echo ""
echo "=========================================="
echo "ステップ1: GitHubリポジトリの作成"
echo "=========================================="
echo ""
echo "以下の手順でGitHubリポジトリを作成してください:"
echo ""
echo "1. ブラウザで https://github.com/new を開く"
echo "2. リポジトリ名: $REPO_NAME"
echo "3. 公開設定を選択（Private または Public）"
echo "4. ⚠️  重要: 以下のチェックボックスは外してください:"
echo "   - Add a README file"
echo "   - Add .gitignore"
echo "   - Choose a license"
echo "5. 「Create repository」をクリック"
echo ""
read -p "GitHubリポジトリを作成しましたか？ (y/n): " answer

if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
  echo "❌ GitHubリポジトリの作成が必要です"
  exit 1
fi

# リモートを追加
echo ""
echo "=========================================="
echo "ステップ2: Gitリモートの設定"
echo "=========================================="
echo ""

if ! git remote get-url origin &>/dev/null; then
  echo "Gitリモートを追加しています..."
  git remote add origin "$GITHUB_URL"
  
  if [ $? -eq 0 ]; then
    echo "✅ リモートを追加しました"
  else
    echo "❌ リモートの追加に失敗しました"
    exit 1
  fi
else
  echo "✅ リモートは既に設定されています"
fi

# リモートの確認
echo ""
echo "リモート設定:"
git remote -v

# 変更をコミット
echo ""
echo "=========================================="
echo "ステップ3: 変更のコミット"
echo "=========================================="
echo ""

# 変更があるか確認
if [ -n "$(git status --porcelain)" ]; then
  echo "変更をステージングしています..."
  git add .
  
  echo ""
  echo "コミットメッセージを入力してください（Enterでデフォルトを使用）:"
  read -p "> " COMMIT_MSG
  
  if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="Initial commit: Add rakupochi-kintai project"
  fi
  
  git commit -m "$COMMIT_MSG"
  
  if [ $? -eq 0 ]; then
    echo "✅ コミットしました"
  else
    echo "⚠️  コミットに失敗しました（既にコミット済みの可能性があります）"
  fi
else
  echo "✅ コミットする変更がありません"
fi

# GitHubにプッシュ
echo ""
echo "=========================================="
echo "ステップ4: GitHubにプッシュ"
echo "=========================================="
echo ""

echo "GitHubにプッシュしています..."
git push -u origin main

if [ $? -eq 0 ]; then
  echo "✅ GitHubにプッシュしました"
else
  echo "❌ プッシュに失敗しました"
  echo ""
  echo "エラーが発生した場合の対処法:"
  echo "1. GitHubリポジトリが正しく作成されているか確認"
  echo "2. GitHubの認証情報が正しいか確認"
  echo "3. 手動でプッシュ: git push -u origin main"
  exit 1
fi

echo ""
echo "=========================================="
echo "ステップ5: Vercelで接続"
echo "=========================================="
echo ""
echo "✅ GitHubリポジトリの準備が完了しました！"
echo ""
echo "次の手順:"
echo "1. Vercelダッシュボードにアクセス: https://vercel.com"
echo "2. プロジェクト 'rakupochi-kintai' を選択"
echo "3. 「Settings」タブ → 「Git」セクション"
echo "4. 「Connect Git Repository」をクリック"
echo "5. '$REPO_NAME' リポジトリを選択して「Connect」をクリック"
echo ""
echo "リポジトリURL: $GITHUB_URL"
echo ""
