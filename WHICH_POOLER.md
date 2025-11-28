# 接続プールの選択

## 推奨: Session pooler

VercelはIPv4ネットワークを使用しているため、**「Session pooler」**を選択してください。

### 理由

1. **IPv4互換性**: Session poolerの説明に「when connecting via an IPv4 network」と明記されている
2. **警告への対応**: 警告メッセージ「use Shared Pooler if on a IPv4 network」に対応
3. **Next.jsとの互換性**: Next.jsのAPIルートでも問題なく動作する

## 選択手順

1. 「Method」ドロップダウンで「Session pooler」を選択
2. 「Shared Pooler」ボタンをクリック
3. 表示された接続文字列をコピー
4. `[YOUR_PASSWORD]` を `Moto0625` に置き換える

## 代替案: Transaction pooler

もしSession poolerが動作しない場合は、「Transaction pooler」の「Shared Pooler」も試せます。こちらは「serverless functions」に適していると説明されています。

