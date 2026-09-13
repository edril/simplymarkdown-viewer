const path = require('path');
const { signAsync } = require('@electron/osx-sign');

const entitlementsPath = path.resolve(__dirname, 'entitlements.plist');

signAsync({
  app: path.resolve(__dirname, 'release/mac-arm64/SimplyMarkdown Viewer.app'),
  identity: '-',
  identityValidation: false,
  hardenedRuntime: true,
  optionsForFile: () => ({
    entitlements: entitlementsPath,
    hardenedRuntime: true,
  }),
})
  .then(() => console.log('signed ok'))
  .catch((err) => {
    console.error('sign failed', err);
    process.exit(1);
  });
