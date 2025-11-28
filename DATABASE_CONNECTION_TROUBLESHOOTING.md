# データベース接続のトラブルシューティング

## 現在の状況

接続文字列は正しく設定されましたが、データベースサーバーに接続できていません。

## 考えられる原因

### 1. データベースが一時停止している（最も可能性が高い）

Supabaseの無料プランでは、一定期間アクセスがないとデータベースが自動的に一時停止します。

**確認方法:**
1. Supabaseダッシュボードのトップページを開く
2. プロジェクトの状態を確認
   - 「Paused」や「Inactive」になっていないか
   - プロジェクト名の横に一時停止アイコンが表示されていないか

**解決方法:**
1. プロジェクトが一時停止している場合、「Resume」または「Restore」ボタンをクリック
2. データベースが再開されるまで数分待つ（通常1-2分）
3. 再開後、再度接続を試す

### 2. 接続文字列の形式

現在設定している接続文字列:
```
postgresql://postgres:Moto0625@db.qhjefghdnsyordbdkqyf.supabase.co:5432/postgres?sslmode=require
```

### 3. 接続プールURLを試す

直接接続が動作しない場合、接続プールURLを試してください：

```
postgresql://postgres:Moto0625@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true
```

## 次のステップ

1. **Supabaseダッシュボードでデータベースの状態を確認**
   - 一時停止している場合は再開

2. **データベースがアクティブになったら、接続を再試行**
   - 以下のURLにアクセスして確認:
     ```
     https://rakupochi-kintai.vercel.app/api/admin/check-users
     ```

3. **それでも接続できない場合**
   - Supabaseの「Settings → Database」ページで接続文字列を再確認
   - パスワードが正しいか確認
   - 接続プールURLを試す

## 接続確認コマンド

データベースが再開されたら、以下のコマンドで接続を確認できます：

```bash
curl https://rakupochi-kintai.vercel.app/api/admin/check-users
```

成功すると、ユーザー一覧がJSON形式で返されます。

