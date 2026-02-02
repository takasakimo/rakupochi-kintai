/**
 * 有給休暇関連のユーティリティ関数
 */

/**
 * 勤続年数に基づいて有給付与日数を計算
 * 労働基準法に基づいた計算
 * @param yearsOfService 勤続年数（年単位、小数点以下も含む）
 * @returns 有給付与日数
 */
export function calculatePaidLeaveDays(yearsOfService: number | null): number {
  if (!yearsOfService || yearsOfService < 0) {
    return 0
  }

  // 6ヶ月未満は0日
  if (yearsOfService < 0.5) {
    return 0
  }

  // 6ヶ月以上1年未満: 10日
  if (yearsOfService < 1) {
    return 10
  }

  // 1年6ヶ月以上2年未満: 11日
  if (yearsOfService < 2) {
    return 11
  }

  // 2年6ヶ月以上3年未満: 12日
  if (yearsOfService < 3) {
    return 12
  }

  // 3年6ヶ月以上4年未満: 14日
  if (yearsOfService < 4) {
    return 14
  }

  // 4年6ヶ月以上5年未満: 16日
  if (yearsOfService < 5) {
    return 16
  }

  // 5年6ヶ月以上6年未満: 18日
  if (yearsOfService < 6) {
    return 18
  }

  // 6年6ヶ月以上: 20日
  return 20
}

/**
 * 有給の起算日（付与日）になった際に、消滅分を減らして新規付与分を追加する処理
 * @param currentBalance 現在の有給残数
 * @param grantDate 有給付与日（起算日）
 * @param yearsOfService 勤続年数
 * @param currentDate 現在の日付（デフォルト: 今日）
 * @returns 更新後の有給残数と、更新が必要かどうかのフラグ
 */
export function processPaidLeaveOnGrantDate(
  currentBalance: number,
  grantDate: Date,
  yearsOfService: number | null,
  currentDate: Date = new Date()
): { newBalance: number; shouldUpdate: boolean; expiredDays: number; grantedDays: number } {
  // 有給付与日を年単位で比較（月日のみ）
  const grantMonth = grantDate.getMonth()
  const grantDay = grantDate.getDate()
  const currentMonth = currentDate.getMonth()
  const currentDay = currentDate.getDate()

  // 起算日になったかどうかをチェック（同じ月日）
  const isGrantDate = grantMonth === currentMonth && grantDay === currentDay

  // 起算日でない場合は更新不要
  if (!isGrantDate) {
    return {
      newBalance: currentBalance,
      shouldUpdate: false,
      expiredDays: 0,
      grantedDays: 0,
    }
  }

  // 2年前の付与日を計算（消滅する分）
  const twoYearsAgo = new Date(grantDate)
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

  // 消滅する分を計算（2年前に付与された分）
  // 簡易的に、2年前の勤続年数から計算
  const expiredYearsOfService = (yearsOfService || 0) - 2
  const expiredDays = expiredYearsOfService >= 0.5 
    ? calculatePaidLeaveDays(expiredYearsOfService)
    : 0

  // 新規付与分を計算
  const grantedDays = calculatePaidLeaveDays(yearsOfService)

  // 消滅分を減らして新規付与分を追加
  const newBalance = Math.max(0, currentBalance - expiredDays) + grantedDays

  return {
    newBalance,
    shouldUpdate: true,
    expiredDays,
    grantedDays,
  }
}

/**
 * 有給の2年経過による消滅処理
 * @param currentBalance 現在の有給残数
 * @param grantDate 有給付与日
 * @param currentDate 現在の日付（デフォルト: 今日）
 * @returns 更新後の有給残数と、更新が必要かどうかのフラグ
 */
export function processPaidLeaveExpiration(
  currentBalance: number,
  grantDate: Date,
  currentDate: Date = new Date()
): { newBalance: number; shouldUpdate: boolean } {
  const twoYearsLater = new Date(grantDate)
  twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2)

  // 2年経過していない場合は更新不要
  if (currentDate <= twoYearsLater) {
    return {
      newBalance: currentBalance,
      shouldUpdate: false,
    }
  }

  // 2年経過した場合は残数を0に（ただし、起算日処理で新規付与分が追加される可能性があるため、ここでは0にしない）
  // 実際の消滅処理は起算日処理で行う
  return {
    newBalance: currentBalance,
    shouldUpdate: false,
  }
}
