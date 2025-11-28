# データベースマイグレーション手順

## allowPreOvertimeカラムの追加

`company_settings`テーブルに`allowPreOvertime`カラムを追加する必要があります。

### 方法1: Supabase SQL Editorから実行（推奨）

1. Supabaseダッシュボードにログイン
2. 左メニューから「SQL Editor」を選択
3. 以下のSQLを実行：

```sql
ALTER TABLE "company_settings"
ADD COLUMN IF NOT EXISTS "allowPreOvertime" BOOLEAN DEFAULT false;
```

### 方法2: ローカルから実行（DATABASE_URLが設定されている場合）

```bash
# マイグレーションファイルを実行
psql $DATABASE_URL -f prisma/migrations/add_allow_pre_overtime.sql
```

### 確認

マイグレーションが成功したか確認：

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'company_settings'
AND column_name = 'allowPreOvertime';
```

