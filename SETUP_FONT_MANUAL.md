# フォントファイルの手動配置手順

## 現在の状況

`public/fonts/` ディレクトリは作成済みです。
フォントファイルを手動でダウンロードして配置してください。

## 手順

### 方法1: ブラウザからダウンロード（推奨）

1. ブラウザで以下のURLを開きます：
   https://fonts.google.com/noto/specimen/Noto+Sans+JP

2. ページ下部の「Download family」ボタンをクリック

3. ZIPファイルがダウンロードされます（例: `Noto_Sans_JP.zip`）

4. ZIPファイルを解凍します

5. 解凍したフォルダ内から `NotoSansJP-Regular.ttf` ファイルを見つけます
   - 通常は `Noto_Sans_JP/static/NotoSansJP-Regular.ttf` にあります

6. 以下のコマンドでフォントファイルを配置します：
   ```bash
   # ダウンロードしたファイルを配置（パスを実際のダウンロード場所に変更してください）
   cp ~/Downloads/Noto_Sans_JP/static/NotoSansJP-Regular.ttf /Users/takasakimotonobu/rakupochi-kintai/public/fonts/
   ```

### 方法2: GitHubから直接ダウンロード

1. ブラウザで以下のURLを開きます：
   https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP-Regular.ttf

2. ブラウザがファイルをダウンロードします（または右クリックして「名前を付けてリンク先を保存」）

3. ダウンロードしたファイルを以下の場所に配置します：
   ```bash
   # ダウンロードしたファイルを配置（パスを実際のダウンロード場所に変更してください）
   cp ~/Downloads/NotoSansJP-Regular.ttf /Users/takasakimotonobu/rakupochi-kintai/public/fonts/
   ```

### 確認

フォントファイルが正しく配置されたか確認します：

```bash
cd /Users/takasakimotonobu/rakupochi-kintai
ls -lh public/fonts/NotoSansJP-Regular.ttf
```

ファイルが存在し、サイズが約2-3MB程度であれば正しく配置されています。

### 動作確認

1. 開発サーバーを再起動してください：
   ```bash
   npm run dev
   ```

2. 請求書PDFを生成して、日本語が正しく表示されることを確認してください

## トラブルシューティング

### ファイルが見つからない場合

- ファイル名が正確に `NotoSansJP-Regular.ttf` であることを確認してください（大文字小文字も含めて）
- ファイルのパスが正しいことを確認してください

### 日本語がまだ文字化けする場合

- ブラウザのキャッシュをクリアしてください
- PDFビューアを変更して確認してください（Adobe Acrobat Reader推奨）
- サーバーログを確認して、フォントファイルが正しく読み込まれているか確認してください
