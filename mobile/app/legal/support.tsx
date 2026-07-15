// Built by Anointed Coder.
//
// Support (live). Contact channels come from GET /api/content/contacts and only
// the channels the backend actually returns are shown, each tappable and opened
// through the right scheme (Telegram, WhatsApp, email, phone). Below the
// channels a real "Send us a message" ticket form posts to POST
// /api/support/tickets: a signed-in player has their account attached
// server-side (so no email / phone is asked), while a guest supplies an email or
// phone. Submission surfaces the backend message on failure and a confirmation
// on success.

import { useMemo, useRef, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Card, TextField, PrimaryButton } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { useAuth } from '@/store/auth';
import {
  useContacts,
  useSubmitSupportTicket,
  type ContactsData,
} from '@/lib/api/leaderboard';
import { ApiError } from '@/lib/api/client';
import { LegalHeader } from './index';

type IconName = string;

interface ChannelRow {
  key: string;
  icon: IconName;
  tint: string;
  iconColor: string;
  title: string;
  handle: string;
  meta: string;
  url: string;
}

function telegramUrl(handle: string): string {
  const h = handle.trim();
  if (/^https?:\/\//i.test(h)) return h;
  return `https://t.me/${h.replace(/^@/, '')}`;
}

function whatsappUrl(number: string): string {
  const digits = number.replace(/[^0-9]/g, '');
  return `https://wa.me/${digits}`;
}

// Build the visible channel rows from live contacts, skipping any the backend
// left null so no dead row ever renders.
function buildChannels(contacts: ContactsData | undefined): ChannelRow[] {
  if (!contacts) return [];
  const rows: ChannelRow[] = [];
  if (contacts.telegram) {
    rows.push({
      key: 'telegram',
      icon: 'paper-plane-outline',
      tint: 'bg-blue-500/15',
      iconColor: colors.blue600,
      title: 'Telegram',
      handle: contacts.telegram,
      meta: 'Message us on Telegram',
      url: telegramUrl(contacts.telegram),
    });
  }
  if (contacts.whatsapp) {
    rows.push({
      key: 'whatsapp',
      icon: 'logo-whatsapp',
      tint: 'bg-newg/15',
      iconColor: colors.newg,
      title: 'WhatsApp',
      handle: contacts.whatsapp,
      meta: 'Chat with us on WhatsApp',
      url: whatsappUrl(contacts.whatsapp),
    });
  }
  if (contacts.email) {
    rows.push({
      key: 'email',
      icon: 'mail-outline',
      tint: 'bg-hot/15',
      iconColor: colors.hot,
      title: 'Email',
      handle: contacts.email,
      meta: 'Email our support team',
      url: `mailto:${contacts.email}`,
    });
  }
  if (contacts.phone) {
    rows.push({
      key: 'phone',
      icon: 'call-outline',
      tint: 'bg-gold-500/15',
      iconColor: colors.gold700,
      title: 'Phone',
      handle: contacts.phone,
      meta: 'Call our support line',
      url: `tel:${contacts.phone}`,
    });
  }
  return rows;
}

async function openChannel(url: string): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  } catch {
    // Cannot open this channel on the device: fail quietly, nothing to do.
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SupportScreen() {
  const router = useRouter();
  const { status } = useAuth();
  const isGuest = status !== 'authed';

  const contactsQuery = useContacts();
  const channels = useMemo(() => buildChannels(contactsQuery.data), [contactsQuery.data]);

  const submitTicket = useSubmitSupportTicket();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [msgFocused, setMsgFocused] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const subjectTrim = subject.trim();
  const messageTrim = message.trim();
  const emailTrim = email.trim();
  const phoneTrim = phone.trim();

  const subjectError =
    subjectTrim.length === 0
      ? 'Subject is required'
      : subjectTrim.length < 3
        ? 'Subject must be at least 3 characters'
        : subjectTrim.length > 140
          ? 'Subject must be 140 characters or fewer'
          : undefined;

  const messageError =
    messageTrim.length === 0
      ? 'Message is required'
      : messageTrim.length < 10
        ? 'Message must be at least 10 characters'
        : messageTrim.length > 4000
          ? 'Message must be 4000 characters or fewer'
          : undefined;

  const emailFormatError =
    emailTrim.length > 0 && !EMAIL_RE.test(emailTrim) ? 'Enter a valid email address' : undefined;

  const contactError =
    isGuest && emailTrim.length === 0 && phoneTrim.length === 0
      ? 'Add an email or phone so we can reply'
      : undefined;

  // Show a field error live once it holds invalid content, and the "required"
  // variant only after the first submit attempt.
  const showSubjectError =
    subjectTrim.length > 0 || submitted ? subjectError : undefined;
  const showMessageError =
    messageTrim.length > 0 || submitted ? messageError : undefined;
  const showEmailError = emailFormatError ?? (submitted ? contactError : undefined);

  const formInvalid = !!(subjectError || messageError || emailFormatError || contactError);

  // Synchronous double-submit guard: the isPending flag only flips on the next
  // render, so two taps in the same tick would both create a ticket.
  const submittingRef = useRef(false);

  async function onSubmit() {
    setSubmitted(true);
    if (formInvalid || submittingRef.current || submitTicket.isPending) return;
    submittingRef.current = true;
    setSubmitError(null);
    try {
      await submitTicket.mutateAsync({
        subject: subjectTrim,
        message: messageTrim,
        // A signed-in player is attached server-side, so only a guest sends
        // contact details.
        email: isGuest && emailTrim ? emailTrim : undefined,
        phone: isGuest && phoneTrim ? phoneTrim : undefined,
      });
      setSent(true);
      setSubject('');
      setMessage('');
      setEmail('');
      setPhone('');
      setSubmitted(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429 || err.code === 'RATE_LIMITED') {
          setSubmitError('You are sending messages too quickly. Please wait a moment and try again.');
        } else if (err.code === 'VALIDATION') {
          setSubmitError(
            err.message !== err.code ? err.message : 'Please check the form and try again.',
          );
        } else {
          setSubmitError(
            err.message !== err.code ? err.message : 'Could not send your message. Please try again.',
          );
        }
      } else {
        setSubmitError('Could not send your message. Please try again.');
      }
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <Screen header={<LegalHeader title="Support" />} contentClassName="gap-5 pb-16">
      <View className="gap-1">
        <Text className="text-2xl font-black text-ink">We are here to help</Text>
        <Text className="text-sm text-ink-mute">
          Pick the channel that suits you. Our team answers every day of the week.
        </Text>
      </View>

      {/* Around the clock note */}
      <Card className="border-gold-600/25 bg-gold-500/10">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-gold-500">
            <Icon name="time-outline" size={19} color={colors.ink} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-extrabold text-ink">Around the clock</Text>
            <Text className="mt-0.5 text-xs text-ink-soft">
              Reach us any day of the week and we will get back to you.
            </Text>
          </View>
        </View>
      </Card>

      {/* Live contact channels */}
      <View className="gap-3">
        {contactsQuery.isLoading ? (
          <>
            {[0, 1, 2].map((i) => (
              <View key={i} className="h-[68px] rounded-2xl border border-divider bg-surfaceAlt" />
            ))}
          </>
        ) : contactsQuery.isError ? (
          <Card className="flex-row items-center gap-2">
            <Icon name="cloud-offline" size={18} color={colors.hot} />
            <Text className="flex-1 text-sm text-ink-soft">
              {contactsQuery.error instanceof ApiError && contactsQuery.error.message !== contactsQuery.error.code
                ? contactsQuery.error.message
                : 'Could not load contact channels.'}
            </Text>
            <Pressable onPress={() => contactsQuery.refetch()} hitSlop={8}>
              <Text className="text-sm font-bold text-gold-700">Retry</Text>
            </Pressable>
          </Card>
        ) : channels.length === 0 ? (
          <Card>
            <Text className="text-sm text-ink-soft">
              Contact channels are being updated. Use the message form below and we will reach out.
            </Text>
          </Card>
        ) : (
          channels.map((c) => (
            <Card key={c.key} padded={false} onPress={() => openChannel(c.url)}>
              <View className="flex-row items-center gap-3 p-3.5">
                <View className={cn('h-11 w-11 items-center justify-center rounded-xl', c.tint)}>
                  <Icon name={c.icon} size={21} color={c.iconColor} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-extrabold text-ink">{c.title}</Text>
                  <Text className="mt-0.5 text-sm font-semibold text-ink-soft" numberOfLines={1}>
                    {c.handle}
                  </Text>
                  <Text className="mt-0.5 text-xs text-ink-mute">{c.meta}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.inkMute} />
              </View>
            </Card>
          ))
        )}
      </View>

      {/* Send us a message */}
      <View className="gap-3">
        <View className="flex-row items-center gap-2">
          <Icon name="chatbox-ellipses-outline" size={18} color={colors.gold700} />
          <Text className="text-base font-black text-ink">Send us a message</Text>
        </View>

        {sent ? (
          <Card className="items-center gap-3 border-newg/25 bg-newg/10 py-7">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-newg/15">
              <Icon name="checkmark-circle" size={34} color={colors.newg} />
            </View>
            <Text className="text-center text-base font-black text-ink">Ticket received, we will reply soon</Text>
            <Text className="max-w-[280px] text-center text-sm text-ink-mute">
              Thanks for reaching out. Our team will get back to you as soon as possible.
            </Text>
            <PrimaryButton label="Send another message" icon="add" onPress={() => setSent(false)} />
          </Card>
        ) : (
          <Card className="gap-3.5">
            <TextField
              label="Subject"
              value={subject}
              onChangeText={setSubject}
              placeholder="What do you need help with?"
              icon="pricetag-outline"
              autoCapitalize="sentences"
              error={showSubjectError}
            />

            {/* Message (multiline) */}
            <View>
              <Text className="mb-1.5 text-xs font-bold text-ink-soft">Message</Text>
              <View
                className={cn(
                  'rounded-xl border bg-paper px-3 py-2.5',
                  showMessageError ? 'border-hot' : msgFocused ? 'border-gold-600' : 'border-divider',
                )}
              >
                <TextInput
                  className="min-h-[104px] text-base text-ink"
                  style={{ textAlignVertical: 'top' }}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Tell us what is going on, with any details that help."
                  placeholderTextColor={colors.inkMute}
                  multiline
                  onFocus={() => setMsgFocused(true)}
                  onBlur={() => setMsgFocused(false)}
                />
              </View>
              {showMessageError ? (
                <Text className="mt-1 text-[11px] font-medium text-hot">{showMessageError}</Text>
              ) : (
                <Text className="mt-1 text-[11px] text-ink-mute">{messageTrim.length}/4000</Text>
              )}
            </View>

            {/* Guest-only contact fields: a signed-in player is attached server-side. */}
            {isGuest ? (
              <>
                <TextField
                  label="Email (optional)"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  icon="mail-outline"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={showEmailError}
                />
                <TextField
                  label="Phone (optional)"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+880 1XXXXXXXXX"
                  icon="call-outline"
                  keyboardType="phone-pad"
                  helper="Add an email or a phone so we can reply."
                />
              </>
            ) : null}

            {submitError ? (
              <View className="flex-row items-start gap-2 rounded-xl border border-hot/30 bg-hot/10 px-3 py-2">
                <Icon name="alert-circle" size={16} color={colors.hot} />
                <Text className="flex-1 text-xs font-medium text-hot">{submitError}</Text>
              </View>
            ) : null}

            <PrimaryButton
              label={submitTicket.isPending ? 'Sending...' : 'Send message'}
              icon="send"
              fullWidth
              loading={submitTicket.isPending}
              disabled={submitTicket.isPending}
              onPress={onSubmit}
            />
          </Card>
        )}
      </View>

      {/* Before you message us */}
      <Card>
        <Text className="text-sm font-extrabold text-ink">Before you message us</Text>
        <Text className="mt-1.5 text-xs leading-5 text-ink-mute">
          Have your username ready, and a screenshot if something looks wrong. It helps us sort
          things out on the first reply.
        </Text>
        <Pressable
          onPress={() => router.push('/legal/faq')}
          className="mt-3 flex-row items-center gap-1.5 self-start active:opacity-70"
        >
          <Icon name="help-circle-outline" size={16} color={colors.blue600} />
          <Text className="text-xs font-bold text-blue-600">Check the FAQ first</Text>
        </Pressable>
      </Card>

      <Text className="text-center text-[11px] text-ink-mute">
        Pasha9 support will never ask for your password. Keep it private.
      </Text>
    </Screen>
  );
}
