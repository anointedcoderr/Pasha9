// Built by Anointed Coder.
// Babel setup for Expo SDK 54. The app has no native screens (it is a
// WebView shell around https://pasha9.com), so there is no NativeWind /
// Tailwind pipeline to wire up here.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
