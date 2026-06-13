'use client'

import { useState } from 'react'
import type { ShoppingListItem } from '@/types'
import { saveShoppingList } from '@/lib/shopping-list-storage'

interface ShoppingListEditorProps {
  items: ShoppingListItem[]
  onChange: (items: ShoppingListItem[]) => void
}

function parseBulkInput(input: string): ShoppingListItem[] {
  return input
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const match = token.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
      if (match) return { term: match[1].trim().toLowerCase(), preferredBrand: match[2].trim() }
      return { term: token.toLowerCase() }
    })
}

export function ShoppingListEditor({ items, onChange }: ShoppingListEditorProps) {
  const [newTerm, setNewTerm] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [editingOriginal, setEditingOriginal] = useState<string | null>(null)
  const [editTerm, setEditTerm] = useState('')
  const [editBrand, setEditBrand] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkInput, setBulkInput] = useState('')

  function persist(next: ShoppingListItem[]) {
    saveShoppingList(next)
    onChange(next)
  }

  function addItem() {
    const term = newTerm.trim().toLowerCase()
    if (!term) return
    if (items.some((i) => i.term === term)) return
    persist([...items, { term, ...(newBrand.trim() ? { preferredBrand: newBrand.trim() } : {}) }])
    setNewTerm('')
    setNewBrand('')
  }

  function addBulkItems() {
    const parsed = parseBulkInput(bulkInput)
    const existingTerms = new Set(items.map((i) => i.term))
    const newItems = parsed.filter((i) => !existingTerms.has(i.term))
    if (newItems.length > 0) persist([...items, ...newItems])
    setBulkInput('')
    setBulkMode(false)
  }

  function removeItem(term: string) {
    persist(items.filter((i) => i.term !== term))
  }

  function startEdit(item: ShoppingListItem) {
    setEditingOriginal(item.term)
    setEditTerm(item.term)
    setEditBrand(item.preferredBrand ?? '')
  }

  function commitEdit() {
    if (!editingOriginal) return
    const term = editTerm.trim().toLowerCase()
    if (!term) return
    persist(
      items.map((i) =>
        i.term === editingOriginal
          ? { term, ...(editBrand.trim() ? { preferredBrand: editBrand.trim() } : {}) }
          : i
      )
    )
    setEditingOriginal(null)
  }

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface shadow-sm overflow-hidden">

      {/* Navy header */}
      <div className="bg-brand-primary px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold tracking-widest text-white uppercase">Your Shopping List</h2>
          <p className="text-xs mt-0.5 font-medium text-brand-accent">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        {editingOriginal && (
          <span className="text-xs text-brand-accent animate-pulse">Editing…</span>
        )}
      </div>

      {/* Inline edit form — full-width above grid when active */}
      {editingOriginal && (
        <div className="bg-brand-accent/20 border-b border-brand-accent/40 px-4 py-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-brand-primary uppercase tracking-wide w-full sm:w-auto">
            Edit item
          </span>
          <input
            type="text"
            value={editTerm}
            onChange={(e) => setEditTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingOriginal(null) }}
            placeholder="Item name"
            autoFocus
            className="flex-1 min-w-0 text-sm border border-brand-accent/60 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-accent bg-white"
          />
          <input
            type="text"
            value={editBrand}
            onChange={(e) => setEditBrand(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingOriginal(null) }}
            placeholder="Preferred brand (optional)"
            className="w-44 text-sm border border-brand-accent/60 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-accent bg-white"
          />
          <button
            onClick={commitEdit}
            disabled={!editTerm.trim()}
            className="px-4 py-1.5 bg-brand-primary text-white text-sm font-semibold rounded-lg hover:bg-brand-primary/90 disabled:opacity-40 transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => setEditingOriginal(null)}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Item grid */}
      <div className="px-4 pt-3 pb-1 max-h-[480px] overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">
            Your list is empty — add some items below.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4">
            {items.map((item) => (
              <div
                key={item.term}
                className={`group flex items-start gap-2 py-1.5 border-b border-gray-100 ${
                  editingOriginal === item.term ? 'opacity-40' : ''
                }`}
              >
                <div className="w-3.5 h-3.5 border border-gray-400 rounded-sm flex-shrink-0 mt-[3px]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-brand-primary capitalize leading-snug font-medium">
                    {item.term}
                  </p>
                  {item.preferredBrand && (
                    <p className="text-xs text-brand-secondary font-medium leading-none mt-0.5">
                      {item.preferredBrand}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                  <button
                    onClick={() => startEdit(item)}
                    title="Edit"
                    className="p-0.5 text-gray-300 hover:text-brand-primary transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 019 16.5H7.5v-1.5a2 2 0 01.586-1.414z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeItem(item.term)}
                    title="Remove"
                    className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / bulk form */}
      <div className="border-t border-brand-border bg-brand-bg px-4 py-3 mt-2 space-y-2">
        {bulkMode ? (
          <div className="space-y-2">
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addBulkItems() }}
              placeholder="milk (Greenfields), eggs, chicken (Seara), yoghurt"
              rows={3}
              autoFocus
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={addBulkItems}
                disabled={!bulkInput.trim()}
                className="px-4 py-1.5 bg-brand-primary text-white text-sm font-semibold rounded-lg hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add all
              </button>
              <button
                onClick={() => { setBulkMode(false); setBulkInput('') }}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <span className="text-xs text-gray-400 ml-auto">⌘↵ to add</span>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
              placeholder="Add item (e.g. tomatoes)"
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            />
            <input
              type="text"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
              placeholder="Brand (optional)"
              className="w-36 text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            />
            <button
              onClick={addItem}
              disabled={!newTerm.trim()}
              className="px-4 py-1.5 bg-brand-primary text-white text-sm font-semibold rounded-lg hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        )}
        {!bulkMode && (
          <button
            onClick={() => setBulkMode(true)}
            className="text-xs text-brand-primary opacity-60 hover:opacity-100 transition-opacity"
          >
            + Bulk add (comma-separated)
          </button>
        )}
      </div>
    </div>
  )
}
