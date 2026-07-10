// Built by Anointed Coder.
// Metro config wrapped with NativeWind so global.css (the Tailwind entry)
// is compiled and injected into the bundle.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
