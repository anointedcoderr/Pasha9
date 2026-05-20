import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { ShieldAlert, Clock, BadgeDollarSign, UserMinus } from 'lucide-react';

const TOOLS = [
  { icon: Clock, t: 'Session Limits', b: 'Set a daily session limit to keep play within healthy time boundaries.' },
  { icon: BadgeDollarSign, t: 'Deposit Limits', b: 'Cap how much can be deposited per day, per week, and per month.' },
  { icon: UserMinus, t: 'Self Exclusion', b: 'Temporarily pause your account if you need a break. Contact support to enable.' },
];

export default function ResponsibleGamingPage() {
  return (
    <>
      <PageHeader title="Responsible Gaming" subtitle="Tools and guidance to keep play healthy" icon={<ShieldAlert className="h-5 w-5" />} />

      <Card padding="lg" tone="gold" className="mb-6">
        <h2 className="text-lg font-semibold text-ink-hi">Play within your limits</h2>
        <p className="mt-2 text-sm text-ink-mid">
          Gaming should be fun, never a source of stress or financial pressure. If you ever feel like play is going beyond a healthy boundary, pause, reach out to support, or use one of the tools below.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {TOOLS.map(({ icon: Icon, t, b }) => (
          <Card key={t} padding="md">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-neon/15 bg-neon/10 text-neon">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-3 text-base font-semibold text-ink-hi">{t}</h3>
            <p className="mt-1 text-sm text-ink-mid">{b}</p>
          </Card>
        ))}
      </div>

      <Card padding="lg" className="mt-6">
        <CardHeader title="Need to talk to someone" subtitle="Local helplines and counseling support" />
        <p className="text-sm text-ink-mid">
          If gambling habits feel out of control, please reach out to a qualified counselor or hotline in your region. Support is available and recovery is possible. You can also pause your account at any time by messaging the team via Telegram or WhatsApp.
        </p>
      </Card>
    </>
  );
}
