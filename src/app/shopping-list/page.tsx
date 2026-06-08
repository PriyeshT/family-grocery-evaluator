'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ShoppingListItem } from '@/types'
import { loadShoppingList } from '@/lib/shopping-list-storage'
import { ShoppingListEditor } from '@/components/dashboard/ShoppingListEditor'

export default function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingListItem[]>(() => loadShoppingList())

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to deals
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Shopping List</h1>
            <p className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <ShoppingListEditor items={items} onChange={setItems} />
      </div>
    </main>
  )
}
