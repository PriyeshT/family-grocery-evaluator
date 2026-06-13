interface EmptyStateProps {
  message?: string
}

export function EmptyState({ message = 'No deals found for your shopping list.' }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-brand-border bg-brand-bg p-10 text-center">
      <p className="text-brand-text-secondary">{message}</p>
    </div>
  )
}
