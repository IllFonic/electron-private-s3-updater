# Electron Private S3 Auto Updater

This package enables automatically updating an electron app from a private S3 bucket. It is intended to be close to the built-in electron auto updater in implementation.

Only windows and macois are supported

## Usage

```typescript
import { autoUpdater } from "electron-private-s3-updater";

// Get temporary credentials using your authentication system.
const temporaryCredentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string } = getTemporaryCredentials();

// Create an auto updater
const updater = autoUpdater("us-east-1", "my-private-bucket", "app-name-prefix/", temporaryCredentials);

// Check for updates
updater.checkForUpdates();

// Quit and install
updater.quitAndInstall();
```

### Bucket Format

The s3 bucket is expected to be formatted in the following way:
`optionalprefix/semver/platform/arch/files`

For example:
`testapp/3.2.5/win32/x64/RELEASES`

Note that the v in the semver is optional, it is compatible with or without it.

You can insert the semver into the s3 path when using electron-forge by using the `keyResolver` function. The previous example's `keyResolver` function would be as follows:

```
(filename: string, platform: string, arch: string) => {
     return `testapp/${process.env.npm_package_version}/${platform}/${arch}/${filename}`;
}
```

### Events

The autoUpdater emits all events the built in auto updater emits.
