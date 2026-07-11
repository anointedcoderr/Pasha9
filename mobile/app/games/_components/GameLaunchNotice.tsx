// Built by Anointed Coder.
//
// Presentational banner for the shared launch handler. Renders whichever of the
// two launch-failure states is active:
//   - deposit prompt: the player is under the provider minimum. Shows the exact
//     balance vs required and a Deposit action that routes to /deposit.
//   - error: any other launch failure (provider inactive, network, etc.).
// Nothing renders when both are clear, so screens can mount it unconditionally.

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatBDT } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { GameLaunch } from './useGameLaunch';

export function GameLaunchNotice({ launch }: { launch: GameLaunch }) {
  const router = useRouter();
  const { error, deposit, clear } = launch;

  if (deposit) {
    const shortfall = Math.max(0, deposit.required - deposit.balance);
    return (
      <View className="overflow-hidden rounded-2xl border border-gold-600/30 bg-gold-500/10">
        <View className="flex-row items-start gap-3 p-3.5">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-gold-500/20">
            <Ionicons name="wallet" size={18} color={colors.gold700} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-black text-ink">Deposit to play</Text>
            <Text className="mt-0.5 text-xs text-ink-soft">
              {deposit.gameName ? `${deposit.gameName} requires ` : 'This game requires '}
              at least {formatBDT(deposit.required)} to launch. Your balance is {formatBDT(deposit.balance)}
              {shortfall > 0 ? ` (add ${formatBDT(shortfall)}).` : '.'}
            </Text>
            <View className="mt-3 flex-row items-center gap-2">
              <Pressable
                onPress={() => {
                  clear();
                  router.push('/deposit');
                }}
                className="flex-row items-center gap-1.5 rounded-pill bg-gold-500 px-4 py-2 active:opacity-90"
              >
                <Ionicons name="add-circle" size={15} color={colors.ink} />
                <Text className="text-xs font-black uppercase tracking-wider text-ink">Deposit</Text>
              </Pressable>
              <Pressable onPress={clear} className="rounded-pill border border-divider px-4 py-2 active:opacity-80">
                <Text className="text-xs font-bold text-ink-soft">Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-row items-center gap-2.5 rounded-2xl border border-hot/40 bg-hot/10 px-3.5 py-3">
        <Ionicons name="alert-circle" size={18} color={colors.hot} />
        <Text className="flex-1 text-xs font-medium text-ink">{error}</Text>
        <Pressable onPress={clear} hitSlop={8}>
          <Ionicons name="close" size={16} color={colors.inkMute} />
        </Pressable>
      </View>
    );
  }

  return null;
}
