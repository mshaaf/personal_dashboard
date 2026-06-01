import { useState } from 'react'
import { useUser } from '../hooks/useUser'
import { Card, Btn, Input } from '../components/ui'
import { Mail, Check } from 'lucide-react'

export default function Login() {
  const { signInWithOtp } = useUser()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError(null)
    const { error } = await signInWithOtp(email.trim())
    setSending(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="flex items-center justify-center h-screen bg-bg p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-[20px] font-black tracking-[-0.03em]">
            DASH<span className="text-crimson">.</span>
          </div>
          <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-[var(--text-3)] mt-0.5">Personal OS</div>
        </div>

        <Card>
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Check size={28} className="text-success" />
              <div className="text-[14px] font-semibold">Check your email</div>
              <div className="text-[12px] text-[var(--text-3)]">
                We sent a magic link to <span className="text-[var(--text-2)]">{email}</span>. Open it on this device to sign in.
              </div>
              <Btn variant="ghost" size="sm" onClick={() => setSent(false)}>Use a different email</Btn>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold mb-1">
                <Mail size={15} className="text-crimson" /> Sign in
              </div>
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
              {error && <div className="text-[11px] text-crimson">{error}</div>}
              <Btn type="submit" size="full" disabled={sending}>
                {sending ? 'Sending…' : 'Send magic link'}
              </Btn>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
