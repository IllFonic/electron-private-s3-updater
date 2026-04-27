import { GetObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { app, autoUpdater as electronAutoUpdater } from "electron";
import EventEmitter from "events";
import fs from "fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "path";
class ElectronPrivateS3AutoUpdater extends EventEmitter {
    tempPath = path.join(app.getPath("temp"), "privates3autoupdater");
    s3Client;
    bucket;
    prefix;
    isChecking = false;
    expectError = false;
    constructor(region, bucket, prefix, credentials) {
        super();
        this.initTempPath();
        this.bucket = bucket;
        this.prefix = prefix;
        this.initS3Client(region, credentials);
    }
    initTempPath() {
        if (fs.existsSync(this.tempPath)) {
            fs.rmSync(this.tempPath, { recursive: true, force: true });
        }
        fs.mkdirSync(this.tempPath);
    }
    async parseRelease(releaseFilePath) {
        const releasesFile = await readFile(releaseFilePath, { encoding: "utf8" });
        const releasesSplits = releasesFile.split(" ");
        return releasesSplits[1] ?? "";
    }
    initS3Client(region, credentials) {
        this.s3Client = new S3Client({ region: region, credentials: credentials });
    }
    async downloadFile(key) {
        const pathSplits = key.split("/");
        const fileName = pathSplits[pathSplits.length - 1] || "";
        try {
            const response = await this.s3Client.send(new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
            }));
            if (response.Body) {
                const stream = response.Body.transformToWebStream();
                await writeFile(path.join(this.tempPath, fileName), stream);
            }
        }
        catch (caught) {
            if (caught instanceof S3ServiceException) {
                throw new Error(`Error from S3 while downloading file ${this.bucket}/${key} ${caught.name}: ${caught.message}`);
            }
            else {
                throw caught;
            }
        }
    }
    async downloadAndParseReleaseFile(prefix) {
        // Only supports squirrel.windows. To support other targets, this must download the correct releases file.
        // Mac can probably be supported by downloading the RELEASES.json file and comparing the remote version there to the local version.
        await this.downloadFile(path.join(prefix, "RELEASES").replaceAll(path.sep, "/"));
        return this.parseRelease(path.join(this.tempPath, "RELEASES"));
    }
    initElectronAutoUpdater() {
        const onInternalError = (error) => {
            if (this.expectError) {
                this.expectError = false;
            }
            else {
                this.emit("error", error);
            }
        };
        const onBeforeQuitForUpdate = () => {
            this.emit("before-quit-for-update");
        };
        const onUpdateDownloaded = (...args) => {
            this.emit("update-downloaded", ...args);
        };
        electronAutoUpdater.setFeedURL({ url: this.tempPath });
        electronAutoUpdater.off("error", onInternalError);
        electronAutoUpdater.off("before-quit-for-update", onBeforeQuitForUpdate);
        electronAutoUpdater.off("update-downloaded", onUpdateDownloaded);
        electronAutoUpdater.on("error", onInternalError);
        electronAutoUpdater.on("before-quit-for-update", onBeforeQuitForUpdate);
        electronAutoUpdater.on("update-downloaded", onUpdateDownloaded);
    }
    electronCheckForUpdates() {
        electronAutoUpdater.checkForUpdates();
    }
    emitError(error) {
        this.emit("error", error);
        console.error(error);
        this.isChecking = false;
    }
    /**
     * Begin a check for updates on the private s3 bucket. If this function is called while an update check is already in progress, this function is a no-op.
     */
    async checkForUpdates() {
        // If we're already checking, no op
        if (this.isChecking) {
            return;
        }
        this.emit("checking-for-update");
        const subPath = path.join(process.platform, process.arch).replaceAll(path.sep, "/");
        let fullPath = subPath;
        if (this.prefix && this.prefix.length > 0) {
            fullPath = path.join(this.prefix, subPath).replaceAll(path.sep, "/");
        }
        this.initTempPath();
        const releaseToDownload = await this.downloadAndParseReleaseFile(fullPath);
        let onUpdate = async () => { };
        const onNoUpdate = () => {
            this.emit("update-not-available");
            electronAutoUpdater.off("update-available", onUpdate);
            this.isChecking = false;
        };
        onUpdate = async () => {
            this.emit("update-available");
            electronAutoUpdater.off("update-not-available", onNoUpdate);
            try {
                await this.downloadFile(path.join(fullPath, releaseToDownload).replaceAll(path.sep, "/"));
            }
            catch (caught) {
                this.emitError(caught);
                return;
            }
            this.electronCheckForUpdates();
            this.isChecking = false;
        };
        this.initElectronAutoUpdater();
        electronAutoUpdater.once("update-available", onUpdate);
        electronAutoUpdater.once("update-not-available", onNoUpdate);
        this.expectError = true;
        this.electronCheckForUpdates();
    }
    /**
     * Restarts the app and applies the update. This should only be called after the `update-downloaded` event is emitted.
     */
    quitAndInstall() {
        electronAutoUpdater.quitAndInstall();
    }
}
/**
 * Create a wrapped electron auto updater that uses a private s3 bucket.
 *
 * The s3 bucket is expected to be formatted in the following way:
 * `optionalprefix/semver/platform/arch/files`
 *
 * For example:
 * `testapp/3.2.5/win32/x64/RELEASES`
 *
 * Note that the v in the semver is optional, it is compatible with or without it.
 *
 * You can insert the semver into the s3 path when using electron forge by using the `keyResolver` function. The previous example's `keyResolver` function would be as follows:
 * ```
 * (filename: string, platform: string, arch: string) => {
 *      return `testapp/${process.env.npm_package_version}/${platform}/${arch}/${filename}`;
 * }
 * ```
 *
 * @param region The region to use.
 * @param bucket The bucket the updates are stored in.
 * @param prefix The prefix for the updates, optional. Usually this is your app name, but it should be the same value set on the s3 publisher config for electron-forge. This value should end in `/`.
 * @param credentials The credentials for accessing the bucket, optional. If no credentials are provded, the default credential chain will be used. It is strongly recommended to use temporary credentials.
 */
export function autoUpdater(region, bucket, prefix, credentials) {
    return new ElectronPrivateS3AutoUpdater(region, bucket, prefix, credentials);
}
//# sourceMappingURL=autoUpdater.js.map