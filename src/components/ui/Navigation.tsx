'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { label: 'Home (Deals)', href: '/' },
  { label: 'Promotions', href: '/promotions' },
  { label: 'Shopping List', href: '/shopping-list' },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-20 bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 flex items-center gap-1">
        {NAV_ITEMS.map(({ label, href }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
