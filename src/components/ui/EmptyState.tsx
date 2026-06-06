interface EmptyStateProps {
  message?: string
}

export function EmptyState({ message = 'No deals found for your shopping list.' }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-10 text-center">
      <p className="text-gray-500">{message}</p>
    </div>
  )
}
