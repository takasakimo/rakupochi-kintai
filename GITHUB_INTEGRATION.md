# VercelとGitHub連携の設定手順

## 概要

VercelプロジェクトをGitHubリポジトリと連携することで、以下のメリットがあります：
- GitHubへのプッシュで自動デプロイ
- コミット履歴の表示
- プルリクエストごとのプレビューデプロイ
- デプロイ履歴とコミットの紐付け

## 設定手順

### ステップ1: GitHubリポジトリの作成

1. GitHubにログイン（https://github.com）
2. 右上の「+」→「New repository」をクリック
3. リポジトリ名を入力（例: `rakupochi-kintai`）
4. 公開設定を選択（Private または Public）
5. 「Create repository」をクリック

### ステップ2: ローカルリポジトリにGitHubリモートを追加

```bash
cd /Users/takasakimotonobu/rakupochi-kintai

# GitHubリポジトリのURLを確認（例: https://github.com/takasakimo/rakupochi-kintai.git）
# リモートを追加
git remote add origin https://github.com/YOUR_USERNAME/rakupochi-kintai.git

# リモートが正しく設定されたか確認
git remote -v
```

### ステップ3: コードをGitHubにプッシュ

```bash
# 現在の変更をコミット（必要に応じて）
git add .
git commit -m "Initial commit"

# GitHubにプッシュ
git push -u origin main
```

### ステップ4: VercelでGitHubリポジトリを接続

#### 方法1: Vercelダッシュボードから接続（推奨）

1. Vercelダッシュボードにログイン（https://vercel.com）
2. プロジェクト `rakupochi-kintai` を選択
3. 「Settings」タブを開く
4. 「Git」セクションを開く
5. 「Connect Git Repository」をクリック
6. GitHubを選択して認証
7. `rakupochi-kintai` リポジトリを選択
8. 「Connect」をクリック

#### 方法2: Vercel CLIから接続

```bash
# Vercel CLIでプロジェクトをリンク
vercel link

# プロンプトで以下を選択：
# - Set up and deploy? → No（既存のプロジェクトに接続）
# - Which scope? → あなたのアカウント
# - Link to existing project? → Yes
# - What's the name of your existing project? → rakupochi-kintai
# - In which directory is your code located? → ./
# - Want to override the settings? → No

# GitHubリポジトリを接続
vercel git connect
```

### ステップ5: 接続の確認

1. Vercelダッシュボードでプロジェクトを確認
2. プロジェクトカードにGitHubリポジトリのバッジが表示されることを確認
3. 最新のコミット情報が表示されることを確認

## 接続後の動作

- **自動デプロイ**: `main`ブランチにプッシュすると自動的に本番環境にデプロイ
- **プレビューデプロイ**: 他のブランチにプッシュするとプレビューデプロイが作成される
- **コミット情報**: デプロイ履歴にコミットメッセージとコミットハッシュが表示される

## トラブルシューティング

### GitHubリポジトリが見つからない場合

- VercelアカウントとGitHubアカウントが正しく連携されているか確認
- GitHubリポジトリが存在するか確認
- VercelのGitHub連携設定を確認（Settings → Git → GitHub）

### 接続後も「Connect Git Repository」が表示される場合

- ブラウザをリロード
- Vercelダッシュボードで「Settings」→「Git」を確認
- 必要に応じて、一度接続を解除して再接続

## 注意事項

- GitHubリポジトリに接続すると、Vercel CLIからの直接デプロイ（`vercel --prod`）も引き続き動作します
- 既存のデプロイ履歴は保持されます
- 環境変数などの設定は変更されません
