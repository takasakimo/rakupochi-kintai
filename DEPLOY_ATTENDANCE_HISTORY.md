# 打刻修正履歴機能のデプロイ手順

## 実装内容

打刻修正履歴機能を追加しました。以下の機能が実装されています：

1. **データベーススキーマ**
   - `AttendanceModificationLog` テーブルを追加
   - 修正前後の値、変更フィールド、修正者情報を記録

2. **API機能**
   - 打刻更新時に自動的に修正履歴を記録
   - 打刻削除時に削除履歴を記録
   - 修正履歴取得API (`/api/admin/attendances/[id]/history`)

3. **UI機能**
   - 打刻管理ページに「履歴」ボタンを追加
   - モーダルで修正履歴を表示
   - 変更前後の値を比較表示

## デプロイ手順

### 1. 変更をコミット

```bash
git add .
git commit -m "feat: 打刻修正履歴機能を追加"
git push
```

### 2. データベースマイグレーションの実行

Vercelにデプロイ後、以下のいずれかの方法でマイグレーションを実行してください：

#### 方法1: Vercel CLIを使用（推奨）

```bash
# 環境変数を取得
vercel env pull .env.local

# マイグレーションを実行
npx prisma migrate deploy
```

#### 方法2: Vercelダッシュボードから実行

1. Vercelダッシュボードにログイン
2. プロジェクトを選択
3. 「Deployments」タブを開く
4. 最新のデプロイメントを選択
5. 「Functions」タブを開く
6. 「Run Command」で以下を実行：
   ```bash
   npx prisma migrate deploy
   ```

#### 方法3: ローカルから本番データベースに接続して実行

```bash
# DATABASE_URLを本番環境の接続文字列に設定
export DATABASE_URL="your-production-database-url"

# マイグレーションを実行
npx prisma migrate deploy
```

### 3. Prismaクライアントの再生成（自動実行）

Vercelのビルドプロセスで自動的に実行されます（`package.json`の`postinstall`スクリプト）。

### 4. 動作確認

デプロイ後、以下を確認してください：

1. 打刻管理ページ（`/admin/attendances`）にアクセス
2. 任意の打刻レコードの「履歴」ボタンをクリック
3. 修正履歴が表示されることを確認

## マイグレーションファイル

マイグレーションファイルは以下の場所に作成されています：

```
prisma/migrations/20260128113017_add_attendance_modification_log/migration.sql
```

## トラブルシューティング

### マイグレーションエラー

- データベース接続が正しいか確認
- 既存のテーブルに問題がないか確認
- エラーメッセージを確認して適切に対処

### Prismaクライアントエラー

- `npx prisma generate` を手動で実行
- `node_modules/.prisma` ディレクトリを削除して再生成

### 履歴が表示されない

- マイグレーションが正常に実行されたか確認
- ブラウザのコンソールでエラーを確認
- APIエンドポイントが正しく動作しているか確認

## 注意事項

- マイグレーション実行前に、データベースのバックアップを推奨します
- 本番環境でのマイグレーション実行時は、メンテナンスモードの検討をお勧めします
- 大量のデータがある場合、マイグレーションに時間がかかる可能性があります
