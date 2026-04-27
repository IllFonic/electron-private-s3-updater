import type { AwsCredentialIdentity, AwsCredentialIdentityProvider } from "@smithy/types";
import EventEmitter from "events";
declare class ElectronPrivateS3AutoUpdater extends EventEmitter {
    private tempPath;
    private s3Client;
    private bucket;
    private prefix;
    private isChecking;
    private expectError;
    constructor(region: string, bucket: string, prefix?: string, credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider);
    private initTempPath;
    private parseRelease;
    private initS3Client;
    private downloadFile;
    private downloadAndParseReleaseFile;
    private initElectronAutoUpdater;
    private electronCheckForUpdates;
    private emitError;
    /**
     * Begin a check for updates on the private s3 bucket. If this function is called while an update check is already in progress, this function is a no-op.
     */
    checkForUpdates(): Promise<void>;
    /**
     * Restarts the app and applies the update. This should only be called after the `update-downloaded` event is emitted.
     */
    quitAndInstall(): void;
}
/**
 * Create a wrapped electron auto updater that uses a private s3 bucket.
 *
 * @param region The region to use.
 * @param bucket The bucket the updates are stored in.
 * @param prefix The prefix for the updates, optional. Usually this is your app name, but it should be the same value set on the s3 publisher config for electron-forge. This value should end in `/`.
 * @param credentials The credentials for accessing the bucket, optional. If no credentials are provded, the default credential chain will be used. It is strongly recommended to use temporary credentials.
 */
export declare function autoUpdater(region: string, bucket: string, prefix?: string, credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider): ElectronPrivateS3AutoUpdater;
export {};
//# sourceMappingURL=autoUpdater.d.ts.map