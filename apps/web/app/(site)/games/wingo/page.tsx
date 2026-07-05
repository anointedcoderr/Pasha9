// Built by Anointed Coder.
//
// Pasha WinGo colour-prediction play page. Thin route wrapper: the whole
// live experience (four-mode tabs, round card, countdown takeover,
// betting board, bet sheet, result reveal, win celebration and history)
// lives in WingoGame, which consumes the /api/games/wingo/* endpoints.

'use client';

import { WingoGame } from '@/components/native-games/wingo/WingoGame';

export default function WingoPage() {
  return <WingoGame />;
}
