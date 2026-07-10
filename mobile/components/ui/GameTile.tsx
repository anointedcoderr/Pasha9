// Built by Anointed Coder.
//
// GameTile: a square game thumbnail with a HOT/NEW corner badge, a gold
// Play button, and a name + provider caption. Sized by its parent (pass a
// width class via `className`) so it drops into 3-col grids or horizontal
// rows unchanged.
//
// Props:
//   game          Game       the game record (name, provider, image, flags)
//   onPress       () => void  tap handler (defaults to a no-op)
//   showProvider  boolean     show the provider label (default true)
//   className     string      width/spacing from the parent grid

import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from './Badge';
import { Gradient } from './Gradient';
import { gradients, colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import type { Game } from '@/lib/mock/games';

export interface GameTileProps {
  game: Game;
  onPress?: () => void;
  showProvider?: boolean;
  className?: string;
}

export function GameTile({ game, onPress, showProvider = true, className }: GameTileProps) {
  return (
    <Pressable onPress={onPress} className={cn('active:opacity-90', className)}>
      <View className="relative aspect-square w-full overflow-hidden rounded-2xl border border-divider bg-surfaceAlt">
        <Image
          source={{ uri: game.imageUrl }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />

        {/* Corner status badge */}
        {game.isHot ? (
          <View className="absolute left-1.5 top-1.5">
            <Badge label="HOT" variant="hot" />
          </View>
        ) : game.isNew ? (
          <View className="absolute left-1.5 top-1.5">
            <Badge label="NEW" variant="new" />
          </View>
        ) : null}

        {/* Gold play button */}
        <View className="absolute bottom-1.5 right-1.5 h-8 w-8 items-center justify-center overflow-hidden rounded-full">
          <Gradient colors={gradients.gold} radius={999} />
          <Ionicons name="play" size={16} color={colors.ink} />
        </View>
      </View>

      <Text className="mt-1.5 text-xs font-bold text-ink" numberOfLines={1}>
        {game.name}
      </Text>
      {showProvider ? (
        <Text className="text-[10px] text-ink-mute" numberOfLines={1}>
          {game.provider}
        </Text>
      ) : null}
    </Pressable>
  );
}
