-- 既存の cleaning_work_records の時刻を JST 補正
-- 修正前: "2026-03-12T19:04" が 19:04 UTC として保存されていた（本来は 19:04 JST = 10:04 UTC）
-- 対応: check_in_at, check_out_at から 9 時間を引いて正しい UTC に変換
-- 対象: JST 対応デプロイ前（2026-03-12 19:20 JST = 10:20 UTC 頃）に作成されたレコードのみ

UPDATE cleaning_work_records
SET
  check_in_at = check_in_at - interval '9 hours',
  check_out_at = CASE WHEN check_out_at IS NOT NULL THEN check_out_at - interval '9 hours' ELSE NULL END
WHERE created_at < '2026-03-12 10:20:00+00';
