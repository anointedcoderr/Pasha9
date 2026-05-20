import type { User } from '@/types';

const handles = [
  'rafiq.ahmed', 'tanvir.hasan', 'mahmuda.akter', 'shanto.99', 'ishrat.j', 'mehedi.k',
  'arif.rahman', 'sumaiya.r', 'parvez.molla', 'nayeem.b', 'sabbir.s', 'mim.akter',
  'rakib.h', 'tonmoy.r', 'farhan.ds', 'sadia.m', 'jubair.r', 'nahid.s',
  'ratul.t', 'mou.ds', 'shahed.s', 'kawsar.k', 'rumana.q', 'tareq.bd',
];

const referrers = ['rafiq.ahmed', 'tanvir.hasan', 'mahmuda.akter', null, 'shanto.99', null];

export const mockUsers: User[] = handles.map((handle, i) => {
  const referredBy = referrers[i % referrers.length] ?? undefined;
  const balance = 200 + ((i * 1739) % 28500);
  const bonus = 50 + ((i * 211) % 1800);
  const locked = (i % 4 === 0) ? 250 + ((i * 73) % 600) : 0;
  return {
    id: `u_${String(i + 1).padStart(4, '0')}`,
    username: handle,
    phone: `01${(700000000 + i * 31337).toString().slice(0, 9)}`,
    email: i % 3 === 0 ? `${handle.replace('.', '_')}@mail.com` : undefined,
    referralCode: handle.toUpperCase().replace(/\W/g, '').slice(0, 8) + (10 + i),
    referredBy: referredBy && referredBy !== handle ? referredBy.toUpperCase().replace(/\W/g, '').slice(0, 8) + 10 : undefined,
    role: i === 0 ? 'super_admin' : i < 2 ? 'admin' : 'user',
    status: i % 11 === 0 ? 'blocked' : i % 7 === 0 ? 'pending' : 'active',
    country: 'BD',
    language: i % 3 === 0 ? 'en' : 'bn',
    createdAt: new Date(Date.now() - (i + 1) * 86400000 * 3).toISOString(),
    balance,
    bonusBalance: bonus,
    lockedBalance: locked,
    totalDeposit: 1000 + ((i * 4271) % 65000),
    totalWithdraw: 200 + ((i * 1933) % 28000),
  };
});

export const currentUser = mockUsers[3]; // shanto.99 for demo dashboard
