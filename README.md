# Electron Private S3 Auto Updater

This package enables automatically updating an electron app from a private S3 bucket. It is intended to be close to the built-in electron auto updater in implementation.

Only squirrel.windows is currently supported. Contributions to add support for other platforms and makes are welcome.

## Usage

Using your package manager of choice:

```
pnpm add @illfonic/electron-private-s3-updater
```

### Implementation

```typescript
import { autoUpdater } from "@illfonic/electron-private-s3-updater";

// Get temporary credentials using your authentication system.
const temporaryCredentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string } = getTemporaryCredentials();

// Create an auto updater
const updater = autoUpdater("us-east-1", "my-private-bucket", "app-name-prefix/", temporaryCredentials);

// Check for updates
updater.checkForUpdates();

// Quit and install
updater.on("update-downloaded", () => {
    updater.quitAndInstall();
});
```

### Bucket Format

The s3 bucket is expected to be formatted in the default s3 publisher configuration (`prefix/platform/arch/files`)

### Events

The autoUpdater emits all events the built in auto updater emits.
