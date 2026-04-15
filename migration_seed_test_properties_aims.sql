-- テスト用管理物件 10件投入（株式会社aimsのみ）
-- Supabase SQL Editor で実行してください
-- 削除するときは migration_delete_test_properties_aims.sql を実行

INSERT INTO properties (
  "company_id",
  name,
  address,
  latitude,
  longitude,
  lock_info,
  has_manager,
  parking_info,
  key_access_info,
  contact_info,
  work_range_notes,
  building_access_info,
  "created_at",
  "updated_at"
)
SELECT
  c.id,
  v.name,
  v.address,
  v.latitude,
  v.longitude,
  v.lock_info,
  v.has_manager,
  v.parking_info,
  v.key_access_info,
  v.contact_info,
  v.work_range_notes,
  v.building_access_info,
  NOW(),
  NOW()
FROM (SELECT id FROM companies WHERE name ILIKE '%aims%' LIMIT 1) c
CROSS JOIN (VALUES
  ('【テスト】物件A 渋谷マンション', '東京都渋谷区神南1-2-3', 35.6595, 139.7004, 'オートロックあり', false, 'コインP隣接', NULL, NULL, NULL, NULL),
  ('【テスト】物件B 港区ビル', '東京都港区赤坂1-2-4', 35.6756, 139.7372, 'オートロック＋インターホン', true, 'ビル地下1F', NULL, NULL, NULL, NULL),
  ('【テスト】物件C 新宿コーポ', '東京都新宿区西新宿2-3-5', 35.6896, 139.6917, '共用部施錠あり', false, '路上駐車可', NULL, NULL, NULL, NULL),
  ('【テスト】物件D 目黒アパート', '東京都目黒区目黒1-2-6', 35.6339, 139.7159, '玄関鍵のみ', true, 'なし', NULL, NULL, NULL, NULL),
  ('【テスト】物件E 品川オフィス', '東京都港区高輪2-3-7', 35.6425, 139.7375, 'オートロック', false, 'コインP 2F', NULL, NULL, NULL, NULL),
  ('【テスト】物件F 渋谷第2', '東京都渋谷区道玄坂2-1-8', 35.6591, 139.6984, 'オートロック', false, 'バイク可', NULL, NULL, NULL, NULL),
  ('【テスト】物件G 新宿第2', '東京都新宿区歌舞伎町1-2-9', 35.6945, 139.7036, '24時間管理人', true, '提携P', NULL, NULL, NULL, NULL),
  ('【テスト】物件H 世田谷戸建', '東京都世田谷区三軒茶屋2-3-10', 35.6433, 139.6722, '玄関鍵', false, '専用駐車1台', NULL, NULL, NULL, NULL),
  ('【テスト】物件I 大田区マンション', '東京都大田区蒲田2-4-11', 35.5617, 139.7162, 'オートロック', true, '駐輪場あり', NULL, NULL, NULL, NULL),
  ('【テスト】物件J 杉並アパート', '東京都杉並区高円寺南2-5-12', 35.7050, 139.6519, '共用部施錠', false, '駐車不可', NULL, NULL, NULL, NULL)
) AS v(name, address, latitude, longitude, lock_info, has_manager, parking_info, key_access_info, contact_info, work_range_notes, building_access_info);

-- 投入件数確認（オプション）
-- SELECT COUNT(*) FROM properties WHERE name LIKE '【テスト】%';
