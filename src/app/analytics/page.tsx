import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions, isAdminEmailResolved } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Visitor analytics and collector insights',
  robots: { index: false, follow: false }, // Private admin page
}

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)
  const isAdmin = Boolean(session?.user?.isAdmin)
    || (session?.user?.email ? await isAdminEmailResolved(session.user.email) : false)

  if (!isAdmin) {
    redirect('/auth/signin?callbackUrl=%2Fadmin%3Ftab%3Danalytics')
  }

  redirect('/admin?tab=analytics')
}