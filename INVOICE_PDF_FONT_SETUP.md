# 請求書PDF日本語フォント設定ガイド

## 概要

請求書PDF生成機能で日本語を正しく表示するには、日本語フォントファイルを追加する必要があります。

## 問題

jsPDFのデフォルトフォント（helvetica）は日本語をサポートしていないため、日本語テキストが文字化けします。

## 解決方法

### 1. NotoSansJPフォントファイルのダウンロード

以下のいずれかの方法でNotoSansJPフォントファイルを取得してください：

#### 方法A: Google Fontsからダウンロード

1. [Google Fonts - Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP) にアクセス
2. 「Download family」をクリック
3. ダウンロードしたZIPファイルを解凍
4. `NotoSansJP-Regular.ttf` ファイルを取得

#### 方法B: npmパッケージから取得

```bash
npm install @fontsource/noto-sans-jp
```

その後、`node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff2` を `NotoSansJP-Regular.ttf` に変換するか、またはTTFファイルを探してください。

### 2. フォントファイルの配置

ダウンロードした `NotoSansJP-Regular.ttf` ファイルを以下のいずれかの場所に配置してください：

- `public/fonts/NotoSansJP-Regular.ttf` （推奨）
- `fonts/NotoSansJP-Regular.ttf`
- `lib/fonts/NotoSansJP-Regular.ttf`

### 3. 確認

フォントファイルを配置した後、請求書PDFを生成して日本語が正しく表示されることを確認してください。

## 注意事項

- フォントファイルが存在しない場合、PDFは生成されますが日本語が文字化けします
- フォントファイルのサイズは約2-3MB程度です
- 本番環境（Vercel等）にデプロイする際も、フォントファイルが含まれていることを確認してください

## トラブルシューティング

### フォントファイルが見つからないエラーが表示される場合

1. フォントファイルのパスを確認してください
2. ファイル名が正確に `NotoSansJP-Regular.ttf` であることを確認してください
3. ファイルの読み取り権限を確認してください

### 日本語がまだ文字化けする場合

1. ブラウザのキャッシュをクリアしてください
2. PDFビューアを変更して確認してください（Adobe Acrobat Reader推奨）
3. フォントファイルが正しく読み込まれているか、サーバーログを確認してください

## 代替案

日本語フォントファイルの追加が困難な場合、以下の代替案を検討してください：

1. **pdfkitへの移行**: `pdfkit`は日本語を標準サポートしています
2. **HTML/CSSからPDF生成**: `puppeteer`や`playwright`を使用してHTMLからPDFを生成
3. **外部PDF生成サービス**: PDF生成を外部サービスに委託
