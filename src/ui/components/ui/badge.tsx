import React from 'react'
// Canonical Badge primitive (migrated from legacy src/components/ui/badge.tsx)
export interface BadgeProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}
export function Badge({ children, className = '', variant = 'default' }: BadgeProps) {
  const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'
  const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
    default: 'bg-blue-100 text-blue-800',
    secondary: 'bg-gray-100 text-gray-800',
    destructive: 'bg-red-100 text-red-800',
    outline: 'border border-gray-200 text-gray-800'
  }
  return <span className={`${base} ${variants[variant]} ${className}`}>{children}</span>
}
