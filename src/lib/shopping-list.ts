import type { ShoppingListItem } from '@/types'

export const DEFAULT_SHOPPING_LIST: ShoppingListItem[] = [
  { term: 'milk', preferredBrand: 'Meiji' },
  { term: 'eggs' },
  { term: 'chicken', preferredBrand: 'Sadia' },
  { term: 'yoghurt' },
  { term: 'bread' },
  { term: 'butter' },
  { term: 'rice' },
  { term: 'cooking oil' },
  { term: 'onions' },
  { term: 'pasta' },
]

/** @deprecated Use loadShoppingList() from shopping-list-storage instead */
export const SHOPPING_LIST: ShoppingListItem[] = DEFAULT_SHOPPING_LIST
