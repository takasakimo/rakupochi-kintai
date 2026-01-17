# デプロイ手順

## Vercelへのデプロイ

### 1. 前提条件

- Vercelアカウント（https://vercel.com）
- PostgreSQLデータベース（Vercel Postgres、Supabase、Neon等）

### 2. データベースの準備

#### Vercel Postgresを使用する場合

1. Vercelダッシュボードでプロジェクトを作成
2. 「Storage」タブから「Create Database」→「Postgres」を選択
3. データベースを作成後、接続文字列をコピー

#### Supabaseを使用する場合

1. https://supabase.com でアカウント作成
2. 新しいプロジェクトを作成
3. プロジェクト設定から接続文字列を取得

### 3. Vercelへのデプロイ

#### 方法1: Vercel CLIを使用

```bash
# Vercel CLIのインストール
npm i -g vercel

# プロジェクトディレクトリに移動
cd rakupochi-kintai

# ログイン
vercel login

# デプロイ
vercel

# 本番環境にデプロイ
vercel --prod
```

#### 方法2: GitHub連携を使用

1. GitHubにリポジトリを作成
2. プロジェクトをプッシュ
3. Vercelダッシュボードで「New Project」を選択
4. GitHubリポジトリをインポート
5. 環境変数を設定（下記参照）
6. 「Deploy」をクリック

### 4. 環境変数の設定

Vercelダッシュボードの「Settings」→「Environment Variables」で以下を設定：

```
DATABASE_URL=postgresql://user:password@host:port/database?schema=public
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-secret-key-here
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key (オプション)
NEXT_PUBLIC_APP_NAME=らくっぽ勤怠
```

**NEXTAUTH_SECRETの生成方法：**
```bash
openssl rand -base64 32
```

### 5. データベースマイグレーション

デプロイ後、データベースマイグレーションを実行：

```bash
# Vercel CLIを使用
vercel env pull .env.local
npx prisma migrate deploy

# または、Vercelのダッシュボードから「Deployments」→「Functions」→「Run Command」で実行
```

### 6. シードデータの投入（オプション）

```bash
npm run db:seed
```

## その他のデプロイオプション

### Railway

1. https://railway.app でアカウント作成
2. 「New Project」→「Deploy from GitHub repo」
3. PostgreSQLサービスを追加
4. 環境変数を設定
5. デプロイ

### Render

1. https://render.com でアカウント作成
2. 「New Web Service」を選択
3. GitHubリポジトリを接続
4. PostgreSQLデータベースを作成
5. 環境変数を設定
6. デプロイ

## トラブルシューティング

### ビルドエラー

- `prisma generate`が失敗する場合、`package.json`の`build`スクリプトを確認
- 環境変数が正しく設定されているか確認

### データベース接続エラー

- `DATABASE_URL`が正しいか確認
- データベースのSSL設定を確認（本番環境では通常必要）
- 接続文字列に`?sslmode=require`を追加

### NextAuthエラー

- `NEXTAUTH_URL`が正しいドメインに設定されているか確認
- `NEXTAUTH_SECRET`が設定されているか確認

