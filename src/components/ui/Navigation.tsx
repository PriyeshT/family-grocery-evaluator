'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { loadShoppingList } from '@/lib/shopping-list-storage'

export function Navigation() {
  const pathname = usePathname()
  const [listCount, setListCount] = useState<number | null>(null)

  useEffect(() => {
    setListCount(loadShoppingList().length)

    const handleStorage = () => setListCount(loadShoppingList().length)
    window.addEventListener('storage', handleStorage)
    window.addEventListener('shopping-list-updated', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('shopping-list-updated', handleStorage)
    }
  }, [])

  return (
    <nav className="sticky top-0 z-20 bg-brand-surface border-b border-brand-border">
      <div className="max-w-5xl mx-auto px-4 flex items-center gap-1">
        {[
          { label: 'Home (Deals)', href: '/' },
          { label: 'Promotions', href: '/promotions' },
        ].map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              pathname === href
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-brand-text-secondary hover:text-brand-primary hover:border-brand-border'
            }`}
          >
            {label}
          </Link>
        ))}
        <Link
          href="/shopping-list"
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-1.5 ${
            pathname === '/shopping-list'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-brand-text-secondary hover:text-brand-primary hover:border-brand-border'
          }`}
        >
          Shopping List
          {listCount !== null && (
            <span className="text-xs text-brand-text-secondary tabular-nums">
              ({listCount})
            </span>
          )}
        </Link>
      </div>
    </nav>
  )
}
