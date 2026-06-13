'use client'

import { useState } from 'react'
import type { ShoppingListItem } from '@/types'
import { loadShoppingList } from '@/lib/shopping-list-storage'
import { ShoppingListEditor } from '@/components/dashboard/ShoppingListEditor'

export default function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingListItem[]>(() => loadShoppingList())

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ShoppingListEditor items={items} onChange={setItems} />
      </div>
    </main>
  )
}
