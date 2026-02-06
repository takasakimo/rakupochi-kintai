# 日本語フォントファイルの配置方法

## 概要

請求書PDFで日本語を正しく表示するには、日本語フォントファイルを追加する必要があります。

## 手順

### 1. フォントファイルのダウンロード

以下のいずれかの方法でNotoSansJPフォントファイルを取得してください：

#### 方法A: Google Fontsから直接ダウンロード（推奨）

1. ブラウザで以下のURLを開きます：
   https://fonts.google.com/noto/specimen/Noto+Sans+JP

2. ページ下部の「Download family」ボタンをクリック

3. ZIPファイルがダウンロードされます（例: `Noto_Sans_JP.zip`）

4. ZIPファイルを解凍します

5. 解凍したフォルダ内から `NotoSansJP-Regular.ttf` ファイルを見つけます
   - 通常は `Noto_Sans_JP/static/NotoSansJP-Regular.ttf` にあります

#### 方法B: コマンドラインでダウンロード（Mac/Linux）

```bash
# プロジェクトのルートディレクトリに移動
cd /Users/takasakimotonobu/rakupochi-kintai

# fontsディレクトリを作成（存在しない場合）
mkdir -p public/fonts

# 一時ディレクトリにダウンロード
cd /tmp
curl -L -o noto-sans-jp.zip "https://fonts.google.com/download?family=Noto%20Sans%20JP"

# ZIPファイルを解凍
unzip -q noto-sans-jp.zip -d noto-sans-jp

# フォントファイルをコピー
cp noto-sans-jp/Noto_Sans_JP/static/NotoSansJP-Regular.ttf /Users/takasakimotonobu/rakupochi-kintai/public/fonts/

# 一時ファイルを削除
rm -rf noto-sans-jp noto-sans-jp.zip
```

### 2. フォントファイルの配置

ダウンロードした `NotoSansJP-Regular.ttf` ファイルを以下の場所に配置してください：

```
rakupochi-kintai/
  └── public/
      └── fonts/
          └── NotoSansJP-Regular.ttf  ← ここに配置
```

### 3. ファイルの確認

以下のコマンドでファイルが正しく配置されたか確認できます：

```bash
ls -lh public/fonts/NotoSansJP-Regular.ttf
```

ファイルが存在し、サイズが約2-3MB程度であれば正しく配置されています。

### 4. 動作確認

1. 開発サーバーを再起動してください：
   ```bash
   npm run dev
   ```

2. 請求書PDFを生成して、日本語が正しく表示されることを確認してください

## トラブルシューティング

### フォントファイルが見つからないエラーが表示される場合

1. ファイルパスを確認してください：
   ```bash
   ls -la public/fonts/
   ```

2. ファイル名が正確に `NotoSansJP-Regular.ttf` であることを確認してください（大文字小文字も含めて）

3. ファイルの読み取り権限を確認してください：
   ```bash
   chmod 644 public/fonts/NotoSansJP-Regular.ttf
   ```

### 日本語がまだ文字化けする場合

1. ブラウザのキャッシュをクリアしてください

2. PDFビューアを変更して確認してください（Adobe Acrobat Reader推奨）

3. サーバーログを確認して、フォントファイルが正しく読み込まれているか確認してください：
   ```bash
   # 開発サーバーのログに以下のような警告が出ていないか確認
   # "Japanese font file not found. Japanese text will be garbled."
   ```

### 本番環境（Vercel）へのデプロイ

Vercelにデプロイする場合も、フォントファイルが含まれていることを確認してください：

1. `public/fonts/NotoSansJP-Regular.ttf` がGitリポジトリに含まれていることを確認
2. `.gitignore` に `public/fonts/` が含まれていないことを確認
3. デプロイ後、PDFを生成して日本語が正しく表示されることを確認

## 注意事項

- フォントファイルのサイズは約2-3MBです
- フォントファイルはGitリポジトリに含める必要があります（`.gitignore`で除外しないでください）
- 本番環境でも同じフォントファイルが必要です
