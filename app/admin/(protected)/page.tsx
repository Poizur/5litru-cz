import { redirect } from 'next/navigation'

export default function AdminIndex() {
  // No dedicated dashboard yet — go straight to catalog.
  redirect('/admin/catalog/')
}
