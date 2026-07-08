// Built by Anointed Coder.
//
// Pasha WinGo colour-prediction play page. Thin route wrapper: the whole
// live experience (four-mode tabs, round card, countdown takeover,
// betting board, bet sheet, result reveal, win celebration and history)
// lives in WingoGame, which consumes the /api/games/wingo/* endpoints.
//
// A compact, read-only LiveWinnersFeed sits below the game so players see
// recent real wins (masked handles) without leaving the table.

'use client';

import { WingoGame } from '@/components/native-games/wingo/WingoGame';
import { LiveWinnersFeed } from '@/components/site/LiveWinnersFeed';

export default function WingoPage() {
  return (
    <div className="space-y-5">
      <WingoGame />
      <LiveWinnersFeed compact />
    </div>
  );
}
