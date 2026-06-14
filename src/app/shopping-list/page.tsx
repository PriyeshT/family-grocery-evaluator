'use client'

import { useState, useEffect } from 'react'
import type { ShoppingListItem } from '@/types'
import { loadShoppingList } from '@/lib/shopping-list-storage'
import { DEFAULT_SHOPPING_LIST } from '@/lib/shopping-list'
import { ShoppingListEditor } from '@/components/dashboard/ShoppingListEditor'

export default function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingListItem[]>(DEFAULT_SHOPPING_LIST)

  useEffect(() => {
    setItems(loadShoppingList())
  }, [])

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ShoppingListEditor items={items} onChange={setItems} />
      </div>
    </main>
  )
}
