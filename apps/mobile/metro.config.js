const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Fallback / mock resolution for web-only peer dependencies and native-only libraries
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@lottiefiles/dotlottie-react': path.resolve(projectRoot, 'mocks/dotlottie-react.js'),
};

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const currentPlatform = platform || context.platform;

  if (moduleName === '@lottiefiles/dotlottie-react') {
    return {
      filePath: path.resolve(projectRoot, 'mocks/dotlottie-react.js'),
      type: 'sourceFile',
    };
  }

  // Intercept react-native-maps on web to prevent codegenNativeComponent crash
  if (moduleName === 'react-native-maps' && currentPlatform !== 'ios' && currentPlatform !== 'android') {
    return {
      filePath: path.resolve(projectRoot, 'mocks/react-native-maps.js'),
      type: 'sourceFile',
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
