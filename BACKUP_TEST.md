# バックアップ機能の動作確認手順

## ✅ 環境変数の確認結果

以下の環境変数が設定されていることを確認しました：

- ✅ `CRON_SECRET` - 設定済み
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - 設定済み
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - 設定済み
- ✅ `BACKUP_STORAGE` - 設定済み

## 動作確認手順

### 方法1: テストスクリプトを使用（推奨）

#### ステップ1: テストスクリプトを実行

```bash
./scripts/test-backup.sh
```

スクリプトが自動的に以下を実行します：
1. 環境変数の確認
2. CRON_SECRETが見つからない場合、Vercel CLIから取得を提案
3. バックアップAPIの呼び出し
4. レスポンスの表示と検証

#### ステップ2: Vercel CLIから環境変数を取得（必要な場合）

CRON_SECRETが見つからない場合、スクリプトが自動的に取得を提案します。
手動で取得する場合：

```bash
# Vercel CLIから環境変数を取得
vercel env pull .env.local

# 再度テストスクリプトを実行
./scripts/test-backup.sh
```

### 方法2: 手動実行でテスト

#### ステップ1: CRON_SECRETを取得

**方法A: Vercel CLIを使用（推奨）**
```bash
vercel env pull .env.local
# .env.localファイルにCRON_SECRETが含まれます
```

**方法B: Vercelダッシュボードから取得**
1. Vercelダッシュボードにログイン
2. プロジェクトを選択
3. 「Settings」→「Environment Variables」を開く
4. `CRON_SECRET` の値をコピー（「Reveal」をクリック）
5. `.env.local` に追加: `CRON_SECRET=your-cron-secret-value`

#### ステップ2: バックアップAPIを実行

ターミナルで以下のコマンドを実行：

```bash
# 最新のデプロイURLを使用
curl -X GET https://rakupochi-kintai-9yve3gw97-aims-projects-264acc6a.vercel.app/api/cron/backup \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

`YOUR_CRON_SECRET` を実際のCRON_SECRETの値に置き換えてください。

#### ステップ3: レスポンスを確認

**成功時のレスポンス例：**
```json
{
  "success": true,
  "message": "バックアップが完了しました",
  "timestamp": "2024-02-10T02-30-00-000Z",
  "stats": {
    "companies": 5,
    "employees": 100,
    "attendances": 5000,
    "shifts": 2000,
    ...
  },
  "backupSize": "1234.56 KB",
  "storage": {
    "provider": "supabase",
    "fileName": "backup-2024-02-10T02-30-00-000Z.json",
    "path": "backup-2024-02-10T02-30-00-000Z.json"
  }
}
```

**エラー時のレスポンス例：**
```json
{
  "error": "Unauthorized"
}
```
→ CRON_SECRETが正しく設定されていない可能性があります

### 方法2: Vercelダッシュボードで確認

#### ステップ1: Cronジョブの実行履歴を確認

1. Vercelダッシュボード → プロジェクトを選択
2. 「Deployments」タブを開く
3. 「Functions」タブを開く
4. 「Cron Jobs」セクションで `/api/cron/backup` を確認
5. 実行履歴とログを確認

#### ステップ2: 実行ログを確認

1. 「Functions」→「Logs」を開く
2. `/api/cron/backup` のログを確認
3. エラーがないか確認

### 方法3: Supabase Storageで確認

#### ステップ1: バックアップファイルを確認

1. Supabaseダッシュボードにログイン
2. プロジェクトを選択
3. 「Storage」→「backups」バケットを開く
4. バックアップファイルが保存されているか確認
5. ファイル名の形式: `backup-YYYY-MM-DDTHH-mm-ss-sssZ.json`

#### ステップ2: ファイルをダウンロードして確認

1. バックアップファイルをクリック
2. 「Download」をクリック
3. JSONファイルの内容を確認
4. データが正しくバックアップされているか確認

## トラブルシューティング

### エラー: "Unauthorized"

**原因**: CRON_SECRETが正しく設定されていない、または値が間違っている

**解決方法**:
1. Vercelダッシュボードで `CRON_SECRET` が正しく設定されているか確認
2. 手動実行の場合は、`Authorization: Bearer YOUR_CRON_SECRET` の値が正しいか確認
3. 環境変数を更新した場合は、再デプロイが必要

### エラー: "Failed to upload backup to Supabase Storage"

**原因**: Supabase Storageへの接続に失敗

**解決方法**:
1. `SUPABASE_SERVICE_ROLE_KEY` が正しく設定されているか確認
2. `NEXT_PUBLIC_SUPABASE_URL` が正しく設定されているか確認
3. Supabase Storageに `backups` バケットが作成されているか確認
4. バケットがプライベートに設定されているか確認

### バックアップファイルが保存されない

**確認項目**:
1. `BACKUP_STORAGE=supabase` が設定されているか確認
2. Supabase Storageの `backups` バケットが存在するか確認
3. Vercelのログでエラーがないか確認

## 自動実行の確認

バックアップは以下のスケジュールで自動実行されます：

- **スケジュール**: 毎日2時（UTC）= 日本時間11時
- **設定場所**: `vercel.json` の `crons` セクション

次回の自動実行後、Supabase Storageにバックアップファイルが保存されているか確認してください。
