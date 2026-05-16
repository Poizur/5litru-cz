import { redirect } from 'next/navigation'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { AdminNav, ADMIN_FONT } from './AdminNav'

async function loadDraftCount(): Promise<number> {
  const { count } = await supabaseAdmin
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'draft')
  return count ?? 0
}

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  const draftCount = await loadDraftCount()

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#FFFFFF',
      color: '#18181B',
      fontFamily: ADMIN_FONT,
      fontSize: '14px',
      lineHeight: 1.4,
    }}>
      <AdminNav draftCount={draftCount} />
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflowX: 'hidden',
      }}>
        {children}
      </main>
    </div>
  )
}
