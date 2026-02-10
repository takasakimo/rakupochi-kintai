# バックアップ設定ガイド（Supabase Storage）

## 概要

データベースのバックアップをSupabase Storageに自動保存する設定手順です。

## 設定手順

### 1. Supabase Storageバケットの作成

1. Supabaseダッシュボードにログイン
2. プロジェクトを選択
3. 左メニューから「Storage」を選択
4. 「Create a new bucket」をクリック
5. 以下の設定でバケットを作成：
   - **Name**: `backups`
   - **Public bucket**: `OFF`（プライベート）
   - 「Create bucket」をクリック

### 2. Storageポリシーの設定（オプション）

セキュリティのため、Service Role Keyのみがアクセスできるように設定：

1. 「Storage」→「backups」バケットを選択
2. 「Policies」タブを開く
3. 必要に応じてポリシーを設定（Service Role Keyを使用する場合は不要）

### 3. 環境変数の設定

Vercelダッシュボードで以下の環境変数を設定：

1. Vercelダッシュボードにログイン
2. プロジェクトを選択
3. 「Settings」→「Environment Variables」を開く
4. 以下の環境変数を追加：

```
BACKUP_STORAGE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-random-secret-key
```

#### 環境変数の取得方法

**NEXT_PUBLIC_SUPABASE_URL**:
- Supabaseダッシュボード → 「Settings」→ 「API」
- 「Project URL」をコピー

**SUPABASE_SERVICE_ROLE_KEY**:
- Supabaseダッシュボード → 「Settings」→ 「API」
- 「Project API keys」セクションの「service_role」キーをコピー
- ⚠️ **重要**: このキーは機密情報です。絶対に公開しないでください。

#### SUPABASE_SERVICE_ROLE_KEYとは？

`SUPABASE_SERVICE_ROLE_KEY`は、Supabaseの**Service Role Key（サービスロールキー）**です。

**特徴：**
- **管理者権限**: Row Level Security (RLS) をバイパスして、すべてのデータにアクセス可能
- **サーバーサイド専用**: ブラウザやクライアント側のコードでは**絶対に使用しない**（セキュリティリスク）
- **用途**: バックアップ、管理タスク、バッチ処理など、サーバー側でのみ実行される処理

**なぜバックアップで必要？**
- バックアップは**プライベートなStorageバケット**に保存する必要があるため
- 通常のAPIキー（anon key）では、プライベートバケットへのアクセスが制限される
- Service Role Keyを使用することで、認証なしでStorageにファイルをアップロードできる

**通常のAPIキー（anon key）との違い：**
- **anon key**: クライアント側で使用可能、RLSの制約を受ける、公開しても比較的安全
- **service_role key**: サーバー側でのみ使用、RLSをバイパス、**絶対に公開してはいけない**

**セキュリティ上の注意：**
- このキーは**環境変数としてのみ保存**し、コードに直接書かない
- GitHubなどの公開リポジトリにコミットしない
- 漏洩した場合は、Supabaseダッシュボードからキーを再生成する

**CRON_SECRET**:
```bash
openssl rand -base64 32
```

### 4. デプロイ

環境変数を設定したら、再デプロイを実行：

```bash
vercel --prod
```

または、Vercelダッシュボードから「Deployments」→「Redeploy」を実行

## バックアップの動作確認

### 1. 環境変数の確認

まず、バックアップ機能に必要な環境変数が設定されているか確認します：

```bash
./scripts/check-backup-env.sh
```

このスクリプトは以下の環境変数をチェックします：
- `BACKUP_STORAGE=supabase`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

### 2. 手動実行でテスト

#### 方法A: テストスクリプトを使用（推奨）

```bash
./scripts/test-backup.sh
```

このスクリプトは以下を実行します：
1. 環境変数の確認
2. バックアップAPIの呼び出し
3. レスポンスの表示と検証
4. 次のステップの案内

#### 方法B: curlコマンドで直接実行

```bash
curl -X GET https://your-domain.vercel.app/api/cron/backup \
  -H "Authorization: Bearer your-cron-secret"
```

成功時のレスポンス例：
```json
{
  "success": true,
  "message": "バックアップが完了しました",
  "timestamp": "2024-01-01T02-00-00-000Z",
  "stats": {
    "companies": 5,
    "employees": 100,
    "attendances": 5000,
    ...
  },
  "backupSize": "1234.56 KB",
  "storage": {
    "provider": "supabase",
    "fileName": "backup-2024-01-01T02-00-00-000Z.json",
    "path": "backup-2024-01-01T02-00-00-000Z.json"
  }
}
```

エラー時のレスポンス例：
```json
{
  "success": false,
  "message": "バックアップデータの取得は完了しましたが、ストレージへの保存に失敗しました",
  "timestamp": "2024-01-01T02-00-00-000Z",
  "stats": { ... },
  "backupSize": "1234.56 KB",
  "storage": {
    "provider": "supabase",
    "error": "Bucket not found",
    "errorCode": 404
  },
  "warning": "ストレージへの保存に失敗しました。ログを確認してください。"
}
```

### 3. Supabase Storageで確認

1. Supabaseダッシュボード → 「Storage」→ 「backups」バケット
2. バックアップファイルが保存されているか確認
3. ファイル名の形式: `backup-YYYY-MM-DDTHH-mm-ss-sssZ.json`

### 4. Cronジョブの確認

1. Vercelダッシュボード → 「Deployments」→ 「Functions」
2. 「Cron Jobs」セクションで `/api/cron/backup` の実行状況を確認
3. スケジュール: 毎日2時（UTC）= 日本時間11時
4. 実行履歴とログを確認して、正常に実行されているか確認

## バックアップの復元

### 手動復元

1. Supabase Storageからバックアップファイルをダウンロード
2. JSONファイルの内容を確認
3. 必要に応じて、データベースに手動でインポート

### 自動復元（今後の実装予定）

復元用のAPIエンドポイントを実装予定です。

## トラブルシューティング

### バックアップが保存されない

1. **環境変数の確認**
   - `BACKUP_STORAGE=supabase` が設定されているか確認
   - `NEXT_PUBLIC_SUPABASE_URL` が正しいか確認
   - `SUPABASE_SERVICE_ROLE_KEY` が正しいか確認

2. **バケットの確認**
   - `backups` バケットが作成されているか確認
   - バケット名が正確に `backups` か確認

3. **ログの確認**
   - Vercelダッシュボード → 「Functions」→ 「Logs」
   - エラーメッセージを確認

### 認証エラー

- `CRON_SECRET` が正しく設定されているか確認
- Vercel Cronからのリクエストには自動的に認証ヘッダーが付与されます

### Storageへのアップロードエラー

- Service Role Keyが正しいか確認
- バケットが存在するか確認
- Storage APIが有効になっているか確認

## バックアップのスケジュール変更

`vercel.json` の `schedule` を編集：

```json
{
  "crons": [
    {
      "path": "/api/cron/backup",
      "schedule": "0 2 * * *"  // 毎日2時（UTC）
    }
  ]
}
```

Cron式の例：
- `"0 2 * * *"` - 毎日2時（UTC）= 日本時間11時
- `"0 0 * * *"` - 毎日0時（UTC）= 日本時間9時
- `"0 0 * * 0"` - 毎週日曜日の0時（UTC）

## セキュリティに関する注意事項

1. **Service Role Keyの管理**
   - Service Role Keyは機密情報です
   - 環境変数としてのみ保存し、コードに直接書かないでください
   - 定期的にローテーションすることを推奨します

2. **バケットのアクセス制御**
   - `backups` バケットはプライベートに設定してください
   - Service Role Keyのみがアクセスできるようにしてください

3. **バックアップファイルの保護**
   - バックアップファイルには機密情報が含まれます
   - 適切なアクセス制御を設定してください

## バックアップの内容

以下のテーブルのデータがバックアップされます：

- Companies（企業情報）
- Employees（従業員情報、パスワードは除外）
- Locations（勤務地情報）
- Attendances（勤怠記録）
- Shifts（シフト情報）
- Applications（申請情報）
- Notifications（通知情報）
- CompanySettings（企業設定）
- Announcements（お知らせ）
- PasswordResetTokens（有効期限が切れていないもののみ）
- AttendanceModificationLogs（勤怠修正ログ）
- SalesVisits（営業訪問記録）

## バックアップサイズの目安

- 小規模（企業数: 1-5、従業員数: 10-50）: 100KB - 1MB
- 中規模（企業数: 5-20、従業員数: 50-200）: 1MB - 10MB
- 大規模（企業数: 20+、従業員数: 200+）: 10MB以上

## ストレージ容量の確認

Supabaseの無料プランでは1GBのストレージが利用可能です。
バックアップファイルのサイズと保存期間に応じて、ストレージ容量を確認してください。
