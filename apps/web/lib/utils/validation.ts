import { z } from 'zod';

const bdPhone = /^(?:\+?880|0)?1[3-9]\d{8}$/;

export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => bdPhone.test(v), { message: 'errorPhone' });

export const passwordSchema = z.string().min(6, { message: 'errorPassword' });

export const loginSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema,
});

export const signupSchema = z
  .object({
    phone: phoneSchema,
    password: passwordSchema,
    confirm: passwordSchema,
    referral: z.string().trim().max(24).optional().or(z.literal('')),
    agree: z.boolean().refine((v) => v === true, { message: 'errorAgree' }),
  })
  .refine((data) => data.password === data.confirm, { path: ['confirm'], message: 'errorMatch' });

export const depositSchema = z.object({
  amount: z.coerce.number().min(100, 'Minimum 100 BDT').max(500000, 'Maximum 500000 BDT'),
  method: z.string().min(1, 'Select a method'),
  txn: z.string().min(6, 'Transaction ID required').max(64),
  note: z.string().max(200).optional(),
});

export const withdrawalSchema = z.object({
  amount: z.coerce.number().min(500, 'Minimum 500 BDT').max(200000, 'Maximum 200000 BDT'),
  method: z.string().min(1, 'Select a method'),
  account: z.string().min(6, 'Account number required').max(40),
  holder: z.string().min(2, 'Holder name required').max(60),
});

export const balanceAdjustSchema = z.object({
  amount: z.coerce.number().refine((v) => v !== 0, 'Amount cannot be zero'),
  reason: z.string().min(6, 'Reason must be at least 6 characters').max(240),
  type: z.enum(['credit', 'debit']),
});

export const bonusRuleSchema = z.object({
  name: z.string().min(2).max(60),
  type: z.enum(['first_deposit', 'daily', 'weekly', 'referral', 'vip', 'invite']),
  amount: z.coerce.number().min(0).max(1_000_000),
  percentage: z.coerce.number().min(0).max(100),
  minDeposit: z.coerce.number().min(0),
  maxBonus: z.coerce.number().min(0),
  status: z.enum(['active', 'paused']),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type DepositInput = z.infer<typeof depositSchema>;
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;
export type BalanceAdjustInput = z.infer<typeof balanceAdjustSchema>;
export type BonusRuleInput = z.infer<typeof bonusRuleSchema>;
