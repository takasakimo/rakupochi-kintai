/**
 * 有給休暇関連のユーティリティ関数
 */

/**
 * 勤続年数に基づいて有給付与日数を計算
 * 会社設定に基づいた計算（設定がない場合は労働基準法のデフォルト値を使用）
 * @param yearsOfService 勤続年数（年単位、小数点以下も含む）
 * @param grantDaysConfig 会社設定の年次ごとの付与日数 {year1: 10, year2: 11, ...}
 * @param firstGrantMonths 初回付与までの月数（デフォルト: 6）
 * @returns 有給付与日数
 */
export function calculatePaidLeaveDays(
  yearsOfService: number | null,
  grantDaysConfig?: { year1?: number; year2?: number; year3?: number; year4?: number; year5?: number; year6?: number; year7?: number } | null,
  firstGrantMonths: number = 6
): number {
  if (!yearsOfService || yearsOfService < 0) {
    return 0
  }

  // 初回付与月数未満は0日
  const firstGrantYears = firstGrantMonths / 12
  if (yearsOfService < firstGrantYears) {
    return 0
  }

  // 設定がある場合は設定値を使用
  if (grantDaysConfig) {
    // 労働基準法に基づいて年数を判定
    // year1: 6ヶ月以上1年6ヶ月未満（0.5年〜1.5年）
    // year2: 1年6ヶ月以上2年6ヶ月未満（1.5年〜2.5年）
    // year3: 2年6ヶ月以上3年6ヶ月未満（2.5年〜3.5年）
    // ...
    let yearNumber: number
    if (yearsOfService < 1.5) {
      yearNumber = 1
    } else if (yearsOfService < 2.5) {
      yearNumber = 2
    } else if (yearsOfService < 3.5) {
      yearNumber = 3
    } else if (yearsOfService < 4.5) {
      yearNumber = 4
    } else if (yearsOfService < 5.5) {
      yearNumber = 5
    } else if (yearsOfService < 6.5) {
      yearNumber = 6
    } else {
      yearNumber = 7
    }
    
    if (yearNumber >= 1 && yearNumber <= 7) {
      const configKey = `year${yearNumber}` as keyof typeof grantDaysConfig
      if (grantDaysConfig[configKey] !== undefined) {
        return grantDaysConfig[configKey] || 0
      }
    }
    
    // 7年目以降は7年目の設定を使用
    if (yearNumber >= 7 && grantDaysConfig.year7 !== undefined) {
      return grantDaysConfig.year7 || 0
    }
  }

  // 設定がない場合は労働基準法のデフォルト値を使用
  // 6ヶ月以上1年6ヶ月未満: 10日
  if (yearsOfService < 1.5) {
    return 10
  }

  // 1年6ヶ月以上2年6ヶ月未満: 11日
  if (yearsOfService < 2.5) {
    return 11
  }

  // 2年6ヶ月以上3年6ヶ月未満: 12日
  if (yearsOfService < 3.5) {
    return 12
  }

  // 3年6ヶ月以上4年6ヶ月未満: 14日
  if (yearsOfService < 4.5) {
    return 14
  }

  // 4年6ヶ月以上5年6ヶ月未満: 16日
  if (yearsOfService < 5.5) {
    return 16
  }

  // 5年6ヶ月以上6年6ヶ月未満: 18日
  if (yearsOfService < 6.5) {
    return 18
  }

  // 6年6ヶ月以上: 20日
  return 20
}

/**
 * 入社日から初回有給付与日を計算
 * @param hireDate 入社日
 * @param firstGrantMonths 初回付与までの月数
 * @returns 初回有給付与日
 */
export function calculateFirstGrantDate(hireDate: Date, firstGrantMonths: number = 6): Date {
  const grantDate = new Date(hireDate)
  grantDate.setMonth(grantDate.getMonth() + firstGrantMonths)
  return grantDate
}

/**
 * 有給の起算日（付与日）になった際に、消滅分を減らして新規付与分を追加する処理
 * @param currentBalance 現在の有給残数
 * @param grantDate 有給付与日（起算日）
 * @param yearsOfService 勤続年数
 * @param grantDaysConfig 会社設定の年次ごとの付与日数
 * @param firstGrantMonths 初回付与までの月数
 * @param currentDate 現在の日付（デフォルト: 今日）
 * @returns 更新後の有給残数と、更新が必要かどうかのフラグ
 */
export function processPaidLeaveOnGrantDate(
  currentBalance: number,
  grantDate: Date,
  yearsOfService: number | null,
  grantDaysConfig?: { year1?: number; year2?: number; year3?: number; year4?: number; year5?: number; year6?: number; year7?: number } | null,
  firstGrantMonths: number = 6,
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

  // 消滅する分を計算（2年前に付与された分）
  // 簡易的に、2年前の勤続年数から計算
  const expiredYearsOfService = (yearsOfService || 0) - 2
  // 負の値や初回付与月数未満の場合は消滅分なし
  const expiredDays = expiredYearsOfService >= (firstGrantMonths / 12) && expiredYearsOfService >= 0
    ? calculatePaidLeaveDays(expiredYearsOfService, grantDaysConfig, firstGrantMonths)
    : 0

  // 新規付与分を計算
  const grantedDays = calculatePaidLeaveDays(yearsOfService, grantDaysConfig, firstGrantMonths)

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

/**
 * 勤続年数から累積の有給残数を計算
 * 過去に付与された有給の累積を計算する（2年経過で消滅する分は考慮しない）
 * @param yearsOfService 勤続年数（年単位、小数点以下も含む）
 * @param grantDaysConfig 会社設定の年次ごとの付与日数 {year1: 10, year2: 11, ...}
 * @param firstGrantMonths 初回付与までの月数（デフォルト: 6）
 * @returns 累積の有給残数
 */
export function calculateTotalPaidLeaveBalance(
  yearsOfService: number | null,
  grantDaysConfig?: { year1?: number; year2?: number; year3?: number; year4?: number; year5?: number; year6?: number; year7?: number } | null,
  firstGrantMonths: number = 6
): number {
  if (!yearsOfService || yearsOfService < 0) {
    return 0
  }

  // 初回付与月数未満は0日
  const firstGrantYears = firstGrantMonths / 12
  if (yearsOfService < firstGrantYears) {
    return 0
  }

  let totalBalance = 0

  // 初回付与から現在までに何回の起算日が経過したかを計算
  // 初回付与は firstGrantMonths 後、その後は毎年1回ずつ付与される
  const yearsSinceFirstGrant = yearsOfService - firstGrantYears
  const numberOfGrants = Math.floor(yearsSinceFirstGrant) + 1 // +1は初回付与分

  // 各付与時点での勤続年数に基づいて付与日数を累積
  for (let i = 0; i < numberOfGrants; i++) {
    // 各付与時点での勤続年数を計算
    // 初回付与時: firstGrantYears（例：0.5年）
    // 1年後の付与時: firstGrantYears + 1（例：1.5年）
    // 2年後の付与時: firstGrantYears + 2（例：2.5年）
    const yearsAtGrant = firstGrantYears + i
    
    // その時点での勤続年数に基づいて付与日数を計算
    const grantDays = calculatePaidLeaveDays(yearsAtGrant, grantDaysConfig, firstGrantMonths)
    totalBalance += grantDays
  }

  return totalBalance
}
