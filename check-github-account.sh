#!/bin/bash

# GitHubアカウントとリポジトリの確認スクリプト

echo "=========================================="
echo "GitHubアカウント・リポジトリ確認"
echo "=========================================="
echo ""

# GitHub CLIがインストールされているか確認
if command -v gh &> /dev/null; then
  echo "✅ GitHub CLIがインストールされています"
  echo ""
  echo "現在ログインしているGitHubアカウント:"
  gh auth status 2>&1 | grep -i "logged in" || echo "  未ログイン"
  echo ""
  
  # ログインしている場合、ユーザー名を取得
  if gh auth status &>/dev/null; then
    GITHUB_USER=$(gh api user --jq .login 2>/dev/null)
    if [ -n "$GITHUB_USER" ]; then
      echo "GitHubユーザー名: $GITHUB_USER"
      echo ""
      
      # rakupochi-kintaiリポジトリの存在確認
      echo "リポジトリ 'rakupochi-kintai' の存在を確認しています..."
      if gh repo view "$GITHUB_USER/rakupochi-kintai" &>/dev/null; then
        echo "✅ リポジトリが存在します: https://github.com/$GITHUB_USER/rakupochi-kintai"
        echo ""
        echo "リポジトリ情報:"
        gh repo view "$GITHUB_USER/rakupochi-kintai" --json name,isPrivate,url,owner
      else
        echo "❌ リポジトリが見つかりませんでした"
        echo ""
        echo "リポジトリを作成しますか？ (y/n)"
        read -p "> " answer
        if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
          echo ""
          echo "リポジトリを作成しています..."
          gh repo create rakupochi-kintai --private --source=. --remote=origin --push 2>/dev/null || \
          gh repo create rakupochi-kintai --public --source=. --remote=origin --push 2>/dev/null
          
          if [ $? -eq 0 ]; then
            echo "✅ リポジトリを作成してプッシュしました"
          else
            echo "❌ リポジトリの作成に失敗しました"
            echo "   手動で作成してください: https://github.com/new"
          fi
        fi
      fi
    fi
  else
    echo "⚠️  GitHub CLIにログインしていません"
    echo ""
    echo "ログインしますか？ (y/n)"
    read -p "> " answer
    if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
      gh auth login
    fi
  fi
else
  echo "⚠️  GitHub CLIがインストールされていません"
  echo ""
  echo "インストール方法:"
  echo "  brew install gh"
  echo ""
  echo "または、手動で確認:"
  echo "1. https://github.com/takasakimo/rakupochi-kintai にアクセス"
  echo "2. リポジトリが存在するか確認"
  echo "3. 存在しない場合は作成: https://github.com/new"
fi

echo ""
echo "=========================================="
echo "Vercelでの確認方法"
echo "=========================================="
echo ""
echo "1. Vercelダッシュボード → Settings → Git"
echo "2. 接続されているGitHubアカウントを確認"
echo "3. 必要に応じて「Switch Git Provider」でアカウントを切り替え"
echo ""
