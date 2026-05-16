import { redirect } from 'next/navigation'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { AdminNav } from './AdminNav'

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminAuthenticated())) redirect('/admin/login')

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: '#0f1a08',
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    }}>
      <AdminNav />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
