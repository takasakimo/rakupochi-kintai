# Supabase接続文字列の取得方法

## 接続文字列を見つける場所

### 1. Supabaseダッシュボードにアクセス
https://supabase.com/dashboard にログイン

### 2. プロジェクトを選択
左側のプロジェクト一覧から、使用するプロジェクトをクリック

### 3. Settings（設定）を開く
左側のメニューから **「Settings」**（⚙️ アイコン）をクリック

### 4. Database（データベース）を選択
Settingsメニューの中から **「Database」** をクリック

### 5. Connection string（接続文字列）セクションを探す
Database設定ページを下にスクロールすると、以下のセクションがあります：

#### 「Connection string」セクション
- このセクションに複数のタブがあります：
  - **URI** - 直接接続用
  - **Connection pooling** - 接続プール用（Vercel推奨）
  - **JDBC** - Java用
  - **Golang** - Go用
  - **Python** - Python用
  - **Node.js** - Node.js用

### 6. Connection poolingタブを選択
**「Connection pooling」** タブをクリック

### 7. Session modeを選択
- **Transaction mode** または **Session mode** のどちらかを選択
- Vercelの場合は **Session mode** を推奨

### 8. 接続文字列をコピー
表示された接続文字列をコピーします。

例：
```
postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**重要**: `[YOUR-PASSWORD]` の部分は、Supabaseのデータベースパスワードに置き換えてください。

### 9. パスワードを確認/リセット
接続文字列にパスワードが含まれていない場合：

1. Database設定ページの上部にある **「Database password」** セクションを確認
2. パスワードがわからない場合は、**「Reset database password」** をクリック
3. 新しいパスワードを設定
4. 接続文字列にパスワードを手動で追加

## 接続文字列の形式

### 接続プール（推奨）
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

### 直接接続（非推奨 - サーバーレス環境では接続が切れる可能性）
```
postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

## Vercel環境変数への設定

1. コピーした接続文字列を、Vercelダッシュボードの環境変数 `DATABASE_URL` に貼り付け
2. すべての環境（Production, Preview, Development）に設定
3. 保存後、再デプロイ

## トラブルシューティング

### 接続文字列が見つからない場合
- Settings → Database ページを下にスクロール
- 「Connection string」セクションはページの下の方にあります
- ブラウザの検索機能（Cmd+F / Ctrl+F）で「Connection string」を検索

### パスワードがわからない場合
- Database設定ページの上部に「Database password」セクションがあります
- 「Reset database password」で新しいパスワードを設定できます

