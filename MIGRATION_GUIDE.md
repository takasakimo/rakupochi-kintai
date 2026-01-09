# データベースマイグレーション実行ガイド

## 問題
現在、社員番号がグローバルにユニークになっているため、別企業で同じ社員番号を使用できません。
企業ごとに社員番号を管理できるようにする必要があります。

## 解決方法

### 方法1: Prismaマイグレーションを使用（推奨）

1. 本番環境の環境変数を取得：
```bash
vercel env pull .env.production
```

2. マイグレーションを実行：
```bash
npx prisma migrate deploy
```

または、スクリプトを実行：
```bash
./run_migration.sh
```

### 方法2: データベース管理画面から直接SQLを実行

Supabaseやその他のデータベース管理画面から、以下のSQLを実行してください：

```sql
-- グローバルユニーク制約を削除
ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_employeeNumber_key";

-- 企業ごとのユニーク制約を追加
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'employees_companyId_employeeNumber_key'
        AND conrelid = 'employees'::regclass
    ) THEN
        ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_employeeNumber_key" 
        UNIQUE ("companyId", "employeeNumber");
    END IF;
END $$;
```

### 方法3: Vercelの環境変数から直接接続

1. Vercelのダッシュボードで `DATABASE_URL` を確認
2. ローカルで以下のコマンドを実行：
```bash
export DATABASE_URL="[VercelのDATABASE_URL]"
npx prisma migrate deploy
```

## 確認

マイグレーション実行後、以下のSQLで制約を確認してください：

```sql
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'employees'::regclass
AND conname LIKE '%employeeNumber%';
```

以下の制約が存在することを確認：
- `employees_companyId_employeeNumber_key` が存在する
- `employees_employeeNumber_key` が存在しない

