import type { ShoppingListItem } from '@/types'
import { DEFAULT_SHOPPING_LIST } from './shopping-list'

const STORAGE_KEY = 'grocery_shopping_list_v1'

export function loadShoppingList(): ShoppingListItem[] {
  if (typeof window === 'undefined') return DEFAULT_SHOPPING_LIST
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SHOPPING_LIST
    return JSON.parse(raw) as ShoppingListItem[]
  } catch {
    return DEFAULT_SHOPPING_LIST
  }
}

export function saveShoppingList(items: ShoppingListItem[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function updateItemBrand(term: string, preferredBrand: string | undefined): void {
  const items = loadShoppingList()
  const updated = items.map((item) =>
    item.term === term ? { ...item, preferredBrand: preferredBrand || undefined } : item
  )
  saveShoppingList(updated)
}
