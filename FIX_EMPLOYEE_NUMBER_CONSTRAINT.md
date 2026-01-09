# 社員番号制約の修正ガイド

## 問題
CSVで従業員情報をインポートする際に、企業IDが異なる場合でも同じ従業員番号を使用できないエラーが発生しています。これは、データベースにグローバルユニーク制約（`employees_employeeNumber_key`）が残っているためです。

## 解決方法

### 1. データベースの制約を確認

まず、現在の制約状態を確認してください：

```sql
-- 現在の制約を確認
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'employees'::regclass
AND (conname LIKE '%employeeNumber%' OR conname LIKE '%companyId%')
ORDER BY conname;

-- インデックスも確認
SELECT 
    indexname AS index_name,
    indexdef AS index_definition
FROM pg_indexes
WHERE tablename = 'employees'
AND (indexname LIKE '%employeeNumber%' OR indexname LIKE '%companyId%')
ORDER BY indexname;
```

### 2. 制約を修正

以下のいずれかの方法で制約を修正してください：

#### 方法A: SQLスクリプトを実行（推奨）

`prisma/migrations/fix_employee_number_constraint.sql` をデータベース管理画面（Supabase、pgAdminなど）で実行してください。

このスクリプトは以下を実行します：
1. 現在の制約を確認
2. グローバルユニーク制約（`employees_employeeNumber_key`）を削除
3. 企業IDと社員番号の複合ユニーク制約（`employees_companyId_employeeNumber_key`）を追加
4. 最終確認

#### 方法B: 手動でSQLを実行

```sql
-- 1. グローバルユニーク制約（UNIQUE INDEX）を削除
DROP INDEX IF EXISTS "employees_employeeNumber_key";

-- 2. グローバルユニーク制約（CONSTRAINT）を削除（念のため）
ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_employeeNumber_key";

-- 3. 既存の複合ユニーク制約を削除（既に存在する場合、再作成するため）
ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_companyId_employeeNumber_key";

-- 4. 複合ユニーク制約を追加（企業IDと社員番号の組み合わせでユニーク）
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_employeeNumber_key" 
UNIQUE ("companyId", "employeeNumber");
```

### 3. 制約の確認

修正後、以下のSQLで制約が正しく設定されているか確認してください：

```sql
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'employees'::regclass
AND (conname LIKE '%employeeNumber%' OR conname LIKE '%companyId%')
ORDER BY conname;
```

**期待される結果：**
- `employees_companyId_employeeNumber_key` が存在する（複合ユニーク制約）
- `employees_employeeNumber_key` が存在しない（グローバルユニーク制約）

### 4. Prismaクライアントの再生成

制約を修正した後、Prismaクライアントを再生成してください：

```bash
npx prisma generate
```

### 5. 動作確認

CSVインポート機能を使用して、異なる企業IDで同じ社員番号を使用できることを確認してください。

## トラブルシューティング

### エラーが解消されない場合

1. **データベース接続を確認**
   - 正しいデータベースに接続しているか確認してください
   - 環境変数 `DATABASE_URL` が正しく設定されているか確認してください

2. **制約が正しく削除されているか確認**
   - 上記の確認SQLを実行して、グローバルユニーク制約が削除されているか確認してください

3. **Prismaクライアントを再生成**
   - `npx prisma generate` を実行して、Prismaクライアントを再生成してください

4. **アプリケーションを再起動**
   - サーバーを再起動して、変更を反映してください

## 注意事項

- この修正は、既存のデータに影響を与えません
- 複合ユニーク制約により、同じ企業内では同じ社員番号を使用できませんが、異なる企業間では同じ社員番号を使用できます
- メールアドレスは引き続きグローバルにユニークです（企業をまたいで同じメールアドレスは使用できません）

