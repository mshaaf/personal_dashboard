import { useState } from 'react'
import { useUser } from '../hooks/useUser'
import { Card, Btn, Input } from '../components/ui'
import { Mail, KeyRound } from 'lucide-react'

export default function Login() {
  const { signInWithOtp, verifyOtp } = useUser()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
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

  async function verify(e) {
    e.preventDefault()
    if (code.trim().length < 6) return
    setVerifying(true)
    setError(null)
    const { error } = await verifyOtp(email.trim(), code.trim())
    setVerifying(false)
    if (error) {
      setError(error.message)
      return
    }
    // onAuthStateChange in useUser hydrates the session and re-renders the app.
  }

  function reset() {
    setSent(false)
    setCode('')
    setError(null)
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
            <form onSubmit={verify} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold mb-1">
                <KeyRound size={15} className="text-crimson" /> Enter your code
              </div>
              <div className="text-[12px] text-[var(--text-3)]">
                We sent a 6-digit code to <span className="text-[var(--text-2)]">{email}</span>. Enter it below to sign in.
              </div>
              <Input
                label="6-digit code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
              {error && <div className="text-[11px] text-crimson">{error}</div>}
              <Btn type="submit" size="full" disabled={verifying || code.trim().length < 6}>
                {verifying ? 'Verifying…' : 'Verify & sign in'}
              </Btn>
              <Btn variant="ghost" size="sm" onClick={reset}>Use a different email</Btn>
            </form>
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
                {sending ? 'Sending…' : 'Send code'}
              </Btn>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
