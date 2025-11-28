# データベースセットアップ手順

## 現在の状況

ビルドとデプロイは成功しましたが、データベースが接続されていない可能性があります。

## データベースのセットアップ方法

### 1. データベースサービスの選択

以下のいずれかを使用できます：

#### Vercel Postgres（推奨）
1. Vercelダッシュボードでプロジェクトを開く
2. 「Storage」タブをクリック
3. 「Create Database」→「Postgres」を選択
4. データベースを作成
5. 接続文字列をコピー

#### Supabase（無料プランあり）
1. https://supabase.com でアカウント作成
2. 新しいプロジェクトを作成
3. 「Settings」→「Database」から接続文字列を取得

#### Neon（無料プランあり）
1. https://neon.tech でアカウント作成
2. 新しいプロジェクトを作成
3. 接続文字列を取得

### 2. DATABASE_URLの設定

#### Vercelダッシュボードで設定
1. プロジェクトの「Settings」→「Environment Variables」
2. `DATABASE_URL`を編集または追加
3. 接続文字列を貼り付け（例：`postgresql://user:password@host:port/database?sslmode=require`）
4. すべての環境（Production, Preview, Development）に設定
5. 「Save」をクリック

#### Vercel CLIで設定
```bash
cd /Users/takasakimotonobu/rakupochi-kintai

# DATABASE_URLを設定
vercel env add DATABASE_URL production
# プロンプトが表示されたら、接続文字列を貼り付け
```

### 3. データベースマイグレーションの実行

環境変数を設定した後、マイグレーションを実行：

```bash
# 環境変数をローカルに取得
vercel env pull .env.local

# マイグレーション実行
npx prisma migrate deploy

# または、Vercelのダッシュボードから「Deployments」→「Functions」→「Run Command」で実行
```

### 4. シードデータの投入（オプション）

```bash
npm run db:seed
```

これにより、以下のテストアカウントが作成されます：
- 管理者: `admin@example.com` / `admin123`
- 従業員: `employee@example.com` / `employee123`

### 5. 再デプロイ

データベース設定後、再デプロイを実行：

```bash
vercel --prod
```

または、Vercelダッシュボードで「Deployments」→「Redeploy」をクリック。

## トラブルシューティング

### データベース接続エラー

- `DATABASE_URL`が正しく設定されているか確認
- 接続文字列に`?sslmode=require`が含まれているか確認（本番環境では通常必要）
- データベースが起動しているか確認

### マイグレーションエラー

- Prismaスキーマが正しいか確認
- データベースの権限を確認
- 接続文字列の形式を確認

