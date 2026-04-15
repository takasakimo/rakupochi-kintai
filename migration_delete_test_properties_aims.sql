-- テスト用管理物件の削除（株式会社aimsのみ）
-- Supabase SQL Editor で実行
-- ※投入した【テスト】プレフィックスの物件のみ削除

DELETE FROM properties
WHERE name LIKE '【テスト】%'
  AND "company_id" = (SELECT id FROM companies WHERE name ILIKE '%aims%' LIMIT 1);
