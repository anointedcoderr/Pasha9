// Built by Anointed Coder.
// Mock upcoming match cards for the Sports carousel on the homepage.
// Replaced by a real sports provider feed in a later milestone.

export interface UpcomingMatch {
  id: string;
  league: string;
  startsAt: string;
  homeTeam: string;
  awayTeam: string;
  homeColor: string;
  awayColor: string;
  category: 'cricket' | 'football' | 'tennis';
}

function future(daysFromNow: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const mockUpcomingMatches: UpcomingMatch[] = [
  {
    id: 'm_001',
    league: 'Indian Premier League',
    startsAt: future(0, 19, 30),
    homeTeam: 'Mumbai Indians',
    awayTeam: 'Rajasthan Royals',
    homeColor: '#1659C2',
    awayColor: '#F5B400',
    category: 'cricket',
  },
  {
    id: 'm_002',
    league: 'Bangabandhu Cup',
    startsAt: future(0, 21, 0),
    homeTeam: 'Bangladesh',
    awayTeam: 'Indonesia',
    homeColor: '#23C26B',
    awayColor: '#FF4E3A',
    category: 'football',
  },
  {
    id: 'm_003',
    league: 'BPL Bangladesh',
    startsAt: future(1, 17, 30),
    homeTeam: 'Dhaka Dynamos',
    awayTeam: 'Chattogram Kings',
    homeColor: '#1659C2',
    awayColor: '#F5B400',
    category: 'cricket',
  },
  {
    id: 'm_004',
    league: 'ICC T20 Friendly',
    startsAt: future(2, 18, 0),
    homeTeam: 'Sri Lanka',
    awayTeam: 'Pakistan',
    homeColor: '#1F8F4F',
    awayColor: '#0F1115',
    category: 'cricket',
  },
  {
    id: 'm_005',
    league: 'Asian Champions League',
    startsAt: future(3, 22, 0),
    homeTeam: 'Mohun Bagan',
    awayTeam: 'Bashundhara Kings',
    homeColor: '#7A1F1F',
    awayColor: '#F5B400',
    category: 'football',
  },
];
