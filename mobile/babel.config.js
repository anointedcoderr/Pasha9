// Built by Anointed Coder.
// Babel setup for Expo SDK 54 + NativeWind v4 + Reanimated v4.
// - babel-preset-expo with jsxImportSource "nativewind" so className is
//   transformed into styles on every RN element.
// - the "nativewind/babel" preset wires the Tailwind pipeline.
// - react-native-worklets/plugin is required by Reanimated v4 and MUST be
//   the last plugin in the list.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: ['react-native-worklets/plugin'],
  };
};
