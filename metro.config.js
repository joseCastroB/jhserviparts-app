const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    extraNodeModules: {
      // Agregamos las nuevas herramientas aquí
      util: require.resolve('util'),
      process: require.resolve('process/browser'), // Ojo: usa 'process/browser'
      url: require.resolve('url'),
      events: require.resolve('events'),
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      stream: require.resolve('stream-browserify'),
      assert: require.resolve('assert'),
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);