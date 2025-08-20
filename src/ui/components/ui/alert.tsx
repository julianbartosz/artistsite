import React from 'react'
// Canonical Alert primitives (migrated from legacy src/components/ui/alert.tsx)
export interface AlertProps { variant?: 'default' | 'destructive'; className?: string; children: React.ReactNode }
export interface AlertDescriptionProps { children: React.ReactNode }
export function Alert({ variant = 'default', className = '', children }: AlertProps) {
  const baseClasses = 'relative w-full rounded-lg border p-4'
  const variantClasses = {
    default: 'border-blue-200 bg-blue-50 text-blue-900',
    destructive: 'border-red-200 bg-red-50 text-red-900'
  } as const
  return <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>{children}</div>
}
export function AlertDescription({ children }: AlertDescriptionProps) {
  return <div className="text-sm [&_p]:leading-relaxed">{children}</div>
}
