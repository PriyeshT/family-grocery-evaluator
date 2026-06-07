'use client'

import { useState } from 'react'
import type { ShoppingListItem } from '@/types'
import { saveShoppingList } from '@/lib/shopping-list-storage'

interface ShoppingListEditorProps {
  items: ShoppingListItem[]
  onChange: (items: ShoppingListItem[]) => void
}

export function ShoppingListEditor({ items, onChange }: ShoppingListEditorProps) {
  const [newTerm, setNewTerm] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [editingTerm, setEditingTerm] = useState<string | null>(null)
  const [editBrand, setEditBrand] = useState('')

  function persist(next: ShoppingListItem[]) {
    saveShoppingList(next)
    onChange(next)
  }

  function addItem() {
    const term = newTerm.trim().toLowerCase()
    if (!term) return
    if (items.some((i) => i.term === term)) return
    const item: ShoppingListItem = { term, ...(newBrand.trim() ? { preferredBrand: newBrand.trim() } : {}) }
    persist([...items, item])
    setNewTerm('')
    setNewBrand('')
  }

  function removeItem(term: string) {
    persist(items.filter((i) => i.term !== term))
  }

  function startEdit(item: ShoppingListItem) {
    setEditingTerm(item.term)
    setEditBrand(item.preferredBrand ?? '')
  }

  function commitEdit(term: string) {
    persist(
      items.map((i) =>
        i.term === term ? { ...i, preferredBrand: editBrand.trim() || undefined } : i
      )
    )
    setEditingTerm(null)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">Shopping List</h2>
        <p className="text-xs text-gray-500 mt-0.5">{items.length} item{items.length !== 1 ? 's' : ''}</p>
      </div>

      <ul className="divide-y divide-gray-100">
        {items.map((item) => (
          <li key={item.term} className="flex items-center gap-3 px-4 py-2.5 group">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 capitalize">{item.term}</p>
              {editingTerm === item.term ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(item.term); if (e.key === 'Escape') setEditingTerm(null) }}
                    placeholder="Preferred brand (optional)"
                    autoFocus
                    className="flex-1 text-xs border border-indigo-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <button
                    onClick={() => commitEdit(item.term)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingTerm(null)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                item.preferredBrand && (
                  <p className="text-xs text-violet-600 mt-0.5">{item.preferredBrand}</p>
                )
              )}
            </div>

            {editingTerm !== item.term && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(item)}
                  title="Edit brand"
                  className="p-1 text-gray-400 hover:text-indigo-600 rounded"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 019 16.5H7.5v-1.5a2 2 0 01.586-1.414z" />
                  </svg>
                </button>
                <button
                  onClick={() => removeItem(item.term)}
                  title="Remove"
                  className="p-1 text-gray-400 hover:text-red-500 rounded"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-lg">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
            placeholder="Add item (e.g. tomatoes)"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
          <input
            type="text"
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
            placeholder="Brand (optional)"
            className="w-32 text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
          <button
            onClick={addItem}
            disabled={!newTerm.trim()}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
