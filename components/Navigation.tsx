'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChefHat, ShoppingCart, BookOpen, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: '在庫管理', href: '/inventory', icon: Home },
  { name: 'レシピ', href: '/recipes', icon: ChefHat },
  { name: '買い物リスト', href: '/shopping-list', icon: ShoppingCart },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <ChefHat className="h-8 w-8 text-primary" />
              <span className="ml-2 text-xl font-bold">AI Kitchen Partner</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium',
                      isActive
                        ? 'border-primary text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    )}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}






