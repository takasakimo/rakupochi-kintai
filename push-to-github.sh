#!/bin/bash

# GitHubへのプッシュ（タイムアウト対策付き）

echo "=========================================="
echo "GitHubへのプッシュ（タイムアウト対策）"
echo "=========================================="
echo ""

# GitのHTTPバッファサイズを増やす（500MB）
echo "GitのHTTPバッファサイズを設定しています..."
git config http.postBuffer 524288000

# タイムアウト時間を増やす
git config http.lowSpeedLimit 0
git config http.lowSpeedTime 999999

echo "✅ Git設定を更新しました"
echo ""

# リモートの確認
echo "リモート設定:"
git remote -v
echo ""

# プッシュを実行
echo "GitHubにプッシュしています..."
echo "（認証が求められる場合は、GitHubのユーザー名とパスワード/トークンを入力してください）"
echo ""

git push -u origin main

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ GitHubにプッシュしました！"
  echo ""
  echo "次のステップ:"
  echo "1. https://github.com/takasakimo/rakupochi-kintai でリポジトリを確認"
  echo "2. Vercelダッシュボード → Settings → Git → Connect Git Repository"
  echo "3. 'rakupochi-kintai' を選択して接続"
else
  echo ""
  echo "⚠️  プッシュに失敗しました"
  echo ""
  echo "対処法:"
  echo "1. GitHubの認証情報を確認"
  echo "2. Personal Access Tokenを使用する場合:"
  echo "   git remote set-url origin https://YOUR_TOKEN@github.com/takasakimo/rakupochi-kintai.git"
  echo "3. または、SSHを使用:"
  echo "   git remote set-url origin git@github.com:takasakimo/rakupochi-kintai.git"
fi
