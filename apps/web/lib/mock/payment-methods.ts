import type { PaymentMethod } from '@/types';

export const mockPaymentMethods: PaymentMethod[] = [
  { id: 'pm_bkash', name: 'bKash', type: 'mobile', status: 'active', number: '01700-000001', instruction: 'Send Money to the displayed bKash number, then enter the TX ID.' },
  { id: 'pm_nagad', name: 'Nagad', type: 'mobile', status: 'active', number: '01710-000002', instruction: 'Use Send Money on the Nagad app to the displayed number.' },
  { id: 'pm_rocket', name: 'Rocket', type: 'mobile', status: 'active', number: '01720-000003', instruction: 'Send to the Rocket account and submit the receipt screenshot.' },
  { id: 'pm_bank', name: 'Bank Transfer', type: 'bank', status: 'active', number: 'AC: 200-122-998877', instruction: 'Transfer to the displayed account. Reference your username in the description.' },
  { id: 'pm_usdt', name: 'USDT TRC20', type: 'crypto', status: 'active', number: 'TRC20: T7v...sZ91', instruction: 'Send only USDT on TRC20 network. Confirmation may take up to 10 minutes.' },
];
