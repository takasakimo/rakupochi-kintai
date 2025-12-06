# テストデータ削除スクリプト

サービスリリース前に、テスト用に作成したアカウントやデータを削除するためのSQLスクリプトです。

## ファイル説明

- `check-test-data.sql`: 削除前にテストデータを確認するクエリ
- `delete-test-data.sql`: テストデータを削除するスクリプト（包括的）
- `delete-test-data-safe.sql`: テストデータを削除するスクリプト（安全版、より厳格な条件）
- `delete-specific-accounts.sql`: 特定のアカウントを指定して削除するスクリプト

## 使用方法

### 1. まず確認クエリを実行

SupabaseのSQL Editorで `check-test-data.sql` を実行し、削除対象のデータを確認してください。

### 2. バックアップを取得

**重要**: 削除前に必ずデータベースのバックアップを取得してください。

Supabaseの場合:
1. Supabase Dashboardにログイン
2. プロジェクトを選択
3. Settings > Database > Backups からバックアップを取得

### 3. 削除スクリプトを実行

#### 安全版（推奨）
より厳格な条件で削除する場合は `delete-test-data-safe.sql` を使用してください。

#### 包括版
より広範囲に削除する場合は `delete-test-data.sql` を使用してください。
**注意**: このスクリプトは全てのadminアカウントを削除対象に含みます。本番環境で必要なadminアカウントがある場合は、スクリプトを修正してください。

### 4. 実行方法

#### Supabase SQL Editorで実行（推奨）
1. Supabase Dashboardにログイン
2. SQL Editorを開く
3. スクリプトをコピー＆ペースト
4. 実行前に内容を確認
5. 実行

#### psqlで実行
```bash
# 環境変数からDATABASE_URLを取得して実行
psql $DATABASE_URL -f scripts/delete-test-data-safe.sql

# または直接接続文字列を指定
psql "postgresql://user:password@host:port/database" -f scripts/delete-test-data-safe.sql
```

#### 特定のアカウントのみ削除する場合
`delete-specific-accounts.sql` を編集して、削除したいemailや企業IDを指定してください。

## 削除対象

### 企業（companies）
- 企業名に"test"または"テスト"が含まれる
- 企業コードに"test"または"demo"が含まれる
- メールアドレスに"test"または"demo"が含まれる

### 従業員（employees）
- メールアドレスに"test"、"admin"、"demo"が含まれる
- 名前に"test"または"テスト"が含まれる
- 社員番号に"test"または"admin"が含まれる

### 注意事項

- 削除はCASCADEで実行されるため、企業を削除すると関連する全てのデータ（従業員、打刻、シフト、申請など）も削除されます
- adminアカウントを削除する場合は、本番環境で必要なアカウントがないか確認してください
- 実行前に必ずバックアップを取得してください

