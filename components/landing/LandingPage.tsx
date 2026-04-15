import Link from 'next/link'
import {
  Clock,
  MapPin,
  Calendar,
  Shield,
  Bell,
  LayoutGrid,
  ChevronRight,
  Mail,
  Phone,
  ExternalLink,
  Timer,
  Link2,
  Check,
  Building2,
  FileText,
  Users,
  Store,
  Wrench,
  Sparkles,
} from 'lucide-react'

const features = [
  {
    icon: Clock,
    title: '4段階打刻システム',
    description:
      '起床→出発→出勤→退勤の4段階で、通勤・勤務時間を正確に記録。企業ごとに2段階打刻（出勤・退勤のみ）への切り替えも可能。',
  },
  {
    icon: MapPin,
    title: 'GPS位置情報連動',
    description:
      '出勤・退勤時は位置情報の取得が必須。最寄り事業所を自動判定し、不正打刻を防止。各事業所ごとに許容範囲（デフォルト500m）を設定可能。',
  },
  {
    icon: LayoutGrid,
    title: 'タイムテーブル',
    description:
      '日付ごとにシフトを時間軸で一覧表示。横軸に時間、縦軸に従業員。ドラッグで編集・休憩の可視化・A4横向き印刷に対応。現場の掲示に最適。',
  },
  {
    icon: Bell,
    title: '自動アラート・通知',
    description:
      '残業40h/60h超・連続勤務（デフォルト6日以上）・有給失効前（30日前）に自動通知。労働基準法遵守を自動で支援。',
  },
  {
    icon: Calendar,
    title: '有給自動管理',
    description:
      '会社の就業規則に合わせた付与ルール設定。入社日基準で自動計算、シフト連動で残数自動更新。手動管理が不要。',
  },
  {
    icon: Shield,
    title: 'マルチテナント',
    description:
      '企業ごとにデータを完全分離。企業コードによる独立したデータベース空間。セキュアな認証で安全に運用。',
  },
  {
    icon: Timer,
    title: '2〜24時間シフト対応',
    description:
      '2時間〜24時間までの柔軟な勤務時間設定。長時間勤務・夜勤にも対応。直行先・退勤場所などの詳細情報も管理可能。',
  },
  {
    icon: Link2,
    title: 'らくっぽリザーブ連携',
    description:
      '勤怠で入力したシフトを予約管理（らくっぽリザーブ）側に自動反映。サロン・店舗の二重入力が不要に。',
  },
]

const problemsAndSolutions = [
  {
    problem: '打刻の信頼性が低い（自宅打刻、位置検証なし）',
    solution: 'GPS必須・4段階打刻・位置の可視化',
  },
  {
    problem: '労働基準法対応が不十分（残業監視・有給管理が手動）',
    solution: '自動アラート・有給の自動計算・シフト連動',
  },
  {
    problem: '大企業向けで複雑・高コスト',
    solution: '中小企業特化・買い切り価格・月額なし',
  },
  {
    problem: '他社データとの混在リスク',
    solution: 'マルチテナントで完全データ分離',
  },
]

const differentiators = [
  '4段階打刻 — 業界初。通勤・勤務を分けて正確に把握',
  'GPS必須 — 出勤・退勤時の位置取得で打刻の信頼性を確保',
  'タイムテーブル — 時間軸表示・ドラッグ編集・印刷で現場運用を支援',
  '有給の自動管理 — 付与ルール・残数・シフト連動を自動化',
  'らくっぽリザーブ連携 — 予約管理と連携し二重入力を解消',
]

const benefits = {
  company: [
    '買い切り価格で初期投資・月額コストを抑制',
    '自動アラートで労働基準法違反リスクを低減',
    'タイムテーブルでシフトの見える化・入力ミス削減',
    '有給残数の自動計算で管理業務を大幅削減',
    'マルチテナントで他社データと完全分離',
  ],
  employee: [
    'シンプルなUIで誰でも簡単に操作可能',
    'スマートフォン対応でどこからでも打刻',
    '4段階打刻で詳細な記録・透明性の向上',
    '申請状況をリアルタイムで確認可能',
  ],
}

const useCases = [
  {
    icon: Store,
    industry: '小規模サービス業（10-30名）',
    issues: '複数店舗・シフト管理・残業管理',
    solutions: 'GPSによる店舗別打刻、タイムテーブル、自動アラート',
  },
  {
    icon: Wrench,
    industry: '製造業（20-50名）',
    issues: '出勤記録・残業適正管理・労基法遵守',
    solutions: '4段階打刻、自動アラート、レポート自動化',
  },
  {
    icon: Building2,
    industry: '建設業（15-40名）',
    issues: '現場ごと打刻・移動時間の把握',
    solutions: 'GPS現場検証、4段階打刻、申請機能',
  },
  {
    icon: Sparkles,
    industry: 'サロン・店舗（らくっぽリザーブ利用）',
    issues: '勤怠と予約でシフトの二重入力',
    solutions: 'らくっぽリザーブ連携で入力一元化',
  },
]

const supportItems = [
  '企業登録・従業員一括登録・事業所登録の初期サポート',
  '管理者向けトレーニング・従業員向けマニュアル',
  'チャット・メールでのオンラインサポート',
]

const targetAudience = [
  '従業員10〜50名程度の中小企業',
  '複数店舗・事業所で勤怠をまとめて管理したい',
  'シフトを「見える化」して確認・印刷・共有したい',
  '労働基準法を守りながら残業・有給をきちんと管理したい',
  '勤怠管理の効率化を図りたい',
  'コストを抑えながら高機能なシステムを導入したい',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-stone-800 tracking-tight">
            らくっぽ勤怠
          </span>
          <div className="flex items-center gap-4">
            <a
              href="#contact"
              className="text-sm text-stone-600 hover:text-stone-900 transition-colors"
            >
              お問い合わせ
            </a>
            <Link
              href="/auth/signin"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
            >
              ログイン
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-amber-600 font-medium tracking-wide text-sm uppercase mb-4">
            中小企業向け 次世代Web勤怠管理システム
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-stone-800 leading-tight tracking-tight mb-6">
            中小企業の勤怠を、
            <br />
            <span className="text-amber-600">正確に・楽に・法に沿って</span>
          </h1>
          <p className="text-lg text-stone-600 max-w-2xl mx-auto mb-6 leading-relaxed">
            従来の勤怠管理システムの課題を解決し、打刻の信頼性・労働基準法対応・
            シフトの「見える化」まで、必要な機能を一つにまとめています。
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
              <Check className="w-4 h-4" /> 信頼性
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
              <Check className="w-4 h-4" /> コンプライアンス
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
              <Check className="w-4 h-4" /> 使いやすさ
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/25"
            >
              お問い合わせ・デモ希望
              <ChevronRight className="w-5 h-5" />
            </a>
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white border-2 border-stone-200 text-stone-700 font-semibold rounded-lg hover:border-stone-300 hover:bg-stone-50 transition-colors"
            >
              ログイン
            </Link>
          </div>
        </div>
      </section>

      {/* 課題と解決策 */}
      <section className="py-16 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-stone-800 text-center mb-12">
            市場の課題と、らくっぽ勤怠の解決策
          </h2>
          <div className="space-y-4">
            {problemsAndSolutions.map((item) => (
              <div
                key={item.problem}
                className="p-4 rounded-xl border border-stone-100 bg-[#faf9f7]/50 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <p className="text-stone-600 text-sm sm:w-2/5">
                  <span className="font-medium text-stone-700">
                    課題：
                  </span>{' '}
                  {item.problem}
                </p>
                <span className="hidden sm:inline text-stone-300">→</span>
                <p className="text-amber-700 text-sm font-medium sm:w-2/5">
                  {item.solution}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 主な特徴 */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-stone-800 mb-4">
              主要機能
            </h2>
            <p className="text-stone-600 max-w-2xl mx-auto">
              打刻の信頼性から申請・レポートまで、現場で使える機能をそろえています
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="p-6 rounded-xl border border-stone-100 bg-white hover:border-stone-200 hover:shadow-lg hover:shadow-stone-100 transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-amber-600" />
                  </div>
                  <h3 className="text-base font-semibold text-stone-800 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-stone-600 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 差別化ポイント */}
      <section className="py-16 px-4 sm:px-6 bg-stone-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-stone-800 text-center mb-12">
            他社との違い
          </h2>
          <ul className="space-y-4">
            {differentiators.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 p-4 rounded-lg bg-white border border-stone-200"
              >
                <Check className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="text-stone-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 導入メリット */}
      <section className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-stone-800 text-center mb-12">
            導入メリット
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-6 rounded-xl border border-stone-100 bg-[#faf9f7]/50">
              <h3 className="text-lg font-semibold text-stone-800 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-600" />
                企業側のメリット
              </h3>
              <ul className="space-y-2">
                {benefits.company.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-stone-600 text-sm">
                    <Check className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6 rounded-xl border border-stone-100 bg-[#faf9f7]/50">
              <h3 className="text-lg font-semibold text-stone-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                従業員側のメリット
              </h3>
              <ul className="space-y-2">
                {benefits.employee.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-stone-600 text-sm">
                    <Check className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 想定ユースケース */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-stone-800 text-center mb-12">
            導入事例・想定ユースケース
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {useCases.map((uc) => {
              const Icon = uc.icon
              return (
                <div
                  key={uc.industry}
                  className="p-6 rounded-xl border border-stone-200 bg-white hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-5 h-5 text-amber-600" />
                    <h3 className="font-semibold text-stone-800">{uc.industry}</h3>
                  </div>
                  <p className="text-stone-600 text-sm mb-2">
                    <span className="font-medium">課題：</span>{uc.issues}
                  </p>
                  <p className="text-amber-700 text-sm font-medium">
                    <span className="font-medium text-stone-700">解決策：</span>{' '}
                    {uc.solutions}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 料金 */}
      <section className="py-20 px-4 sm:px-6 bg-stone-800">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            料金のご案内
          </h2>
          <p className="text-stone-300 text-center mb-12">
            買い切り価格のみ。月額料金はかかりません（クラウドベース）
          </p>
          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            <div className="p-6 rounded-xl bg-amber-500 text-white text-center">
              <p className="text-sm font-medium opacity-90 mb-1">10社限定</p>
              <p className="text-4xl font-bold">49,800</p>
              <p className="text-sm opacity-90">円（税別）</p>
            </div>
            <div className="p-6 rounded-xl bg-stone-700/80 text-white border border-stone-600 text-center">
              <p className="text-sm font-medium text-stone-300 mb-1">11社目以降</p>
              <p className="text-3xl font-bold">99,800</p>
              <p className="text-sm text-stone-400">円（税別）</p>
            </div>
          </div>
          <p className="text-stone-400 text-sm text-center">
            10社限定価格はご契約の先着順です。詳細はお問い合わせ時にご案内します。
          </p>
        </div>
      </section>

      {/* 導入サポート */}
      <section className="py-16 px-4 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-stone-800 text-center mb-8">
            導入サポート
          </h2>
          <ul className="space-y-3">
            {supportItems.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 p-3 rounded-lg border border-stone-100"
              >
                <FileText className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span className="text-stone-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* こんな企業に */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-stone-800 text-center mb-12">
            導入を検討すべき企業
          </h2>
          <ul className="space-y-4">
            {targetAudience.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 p-4 rounded-lg bg-white border border-stone-100 hover:shadow-md hover:border-stone-200 transition-all"
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                </span>
                <span className="text-stone-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA & Contact */}
      <section id="contact" className="py-20 px-4 sm:px-6 bg-stone-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-stone-800 mb-4">
              次のステップ
            </h2>
            <p className="text-stone-600 mb-2">
              デモ体験や導入相談はお気軽にどうぞ
            </p>
            <p className="text-sm text-stone-500 mb-8">
              貴社のニーズに合わせたカスタマイズ提案もいたします
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="mailto:info@aims-ngy.com"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-stone-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-colors text-stone-700 font-medium"
              >
                <Mail className="w-5 h-5 text-amber-600" />
                info@aims-ngy.com
              </a>
              <a
                href="tel:052-990-3127"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-stone-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-colors text-stone-700 font-medium"
              >
                <Phone className="w-5 h-5 text-amber-600" />
                052-990-3127
              </a>
              <a
                href="https://aims-ngy-2023.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-stone-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-colors text-stone-700 font-medium"
              >
                <ExternalLink className="w-5 h-5 text-amber-600" />
                aims-ngy-2023.com
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-stone-200 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-stone-600 text-sm">
            らくっぽ勤怠 — 中小企業向けWebベース勤怠管理システム
          </span>
          <div className="flex items-center gap-6">
            <Link
              href="/auth/signin"
              className="text-sm text-stone-600 hover:text-stone-900 transition-colors"
            >
              ログイン
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
