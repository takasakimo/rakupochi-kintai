# Supabase接続文字列の手動設定ガイド

## 現在の状況

接続文字列が見つからないため、以下の手順で手動で確認・設定してください。

## 方法1: Supabaseダッシュボードで確認（再確認）

### ステップ1: プロジェクトを開く
1. https://supabase.com/dashboard にログイン
2. プロジェクト `qhjefghdnsyordbdkqyf` を選択

### ステップ2: Settings → Database を開く
1. 左側メニューの一番下にある **「Settings」**（⚙️）をクリック
2. Settingsメニューの中から **「Database」** をクリック

### ステップ3: ページ全体を確認
Database設定ページには以下のセクションがあります（上から順に）：
1. **Database password** - パスワードの確認・リセット
2. **Connection info** - 接続情報
3. **Connection pooling configuration** - 接続プールの設定（これは設定画面）
4. **Connection string** ← **ここを探してください！**

### ステップ4: Connection stringセクション
「Connection string」という見出しの下に、複数のタブがあります：
- URI
- **Connection pooling** ← これをクリック
- JDBC
- Golang
- Python
- Node.js

### ステップ5: 接続文字列をコピー
1. **「Connection pooling」** タブをクリック
2. **「Session mode」** を選択
3. 表示された接続文字列を**そのまま**コピー

## 方法2: ブラウザの検索機能を使用

1. Settings → Database ページを開く
2. ブラウザの検索機能を開く：
   - Mac: `Cmd + F`
   - Windows: `Ctrl + F`
3. 「**Connection string**」と入力して検索
4. 見つかった場所をクリック

## 方法3: スクリーンショットを共有

もし見つからない場合は、Settings → Database ページのスクリーンショットを共有していただければ、正確な場所を案内できます。

## 一時的な解決策: 直接接続を使用

接続プールが見つからない場合、一時的に直接接続を使用することもできます：

```
postgresql://postgres:Moto0625@db.qhjefghdnsyordbdkqyf.supabase.co:5432/postgres?sslmode=require
```

ただし、サーバーレス環境では接続が切れる可能性があるため、接続プールの使用を推奨します。

## 確認事項

1. **正しいプロジェクトを開いていますか？**
   - プロジェクト参照: `qhjefghdnsyordbdkqyf`

2. **Settings → Database を開いていますか？**
   - Settings内の他のセクション（API、Auth等）ではありません

3. **ページを十分にスクロールしましたか？**
   - Connection stringはページの下の方にあります

4. **Supabaseのプランで接続プールが利用可能ですか？**
   - 無料プランでも利用可能ですが、確認してください

