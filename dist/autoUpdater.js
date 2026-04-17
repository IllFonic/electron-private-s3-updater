import { GetObjectCommand, paginateListObjectsV2, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { app, autoUpdater as electronAutoUpdater } from "electron";
import EventEmitter from "events";
import fs from "fs";
import { writeFile } from "node:fs/promises";
import path from "path";
import { gte as semverGte, sort as semverSort } from "semver";
class ElectronPrivateS3AutoUpdater extends EventEmitter {
    tempPath = path.join(app.getPath("temp"), "privates3autoupdater");
    s3Client;
    bucket;
    prefix;
    isChecking = false;
    constructor(region, bucket, prefix, credentials) {
        super();
        this.initTempPath();
        this.bucket = bucket;
        this.prefix = prefix;
        this.initS3Client(region, credentials);
    }
    initTempPath() {
        if (fs.existsSync(this.tempPath)) {
            fs.rmdirSync(this.tempPath);
        }
        fs.mkdirSync(this.tempPath);
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
    async downloadUpdate(key) {
        const fullPath = path.join(key, process.platform, process.arch);
        const objectList = [];
        try {
            const paginator = paginateListObjectsV2({ client: this.s3Client, pageSize: 100 }, { Bucket: this.bucket, Prefix: this.prefix });
            for await (const page of paginator) {
                if (page.Contents) {
                    for (const obj of page.Contents) {
                        if (obj.Key) {
                            objectList.push(obj.Key);
                        }
                    }
                }
            }
        }
        catch (caught) {
            if (caught instanceof S3ServiceException) {
                throw new Error(`Error from S3 while listing objects in bucket ${this.bucket} ${caught.name}: ${caught.message}`);
            }
            else {
                throw caught;
            }
        }
        objectList.forEach((element) => {
            this.downloadFile(element);
        });
    }
    initElectronAutoUpdater() {
        electronAutoUpdater.setFeedURL({ url: this.tempPath });
        electronAutoUpdater.off("error", (error) => this.emit("error", error));
        electronAutoUpdater.off("before-quit-for-update", () => this.emit("before-quit-for-update"));
        electronAutoUpdater.on("error", (error) => this.emit("error", error));
        electronAutoUpdater.on("before-quit-for-update", () => this.emit("before-quit-for-update"));
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
        const objectList = {};
        try {
            const paginator = paginateListObjectsV2({ client: this.s3Client, pageSize: 100 }, { Bucket: this.bucket, Prefix: this.prefix });
            for await (const page of paginator) {
                if (page.Contents) {
                    for (const obj of page.Contents) {
                        if (obj.Key) {
                            const splits = obj.Key.split("/");
                            const semver = splits[splits.length - 1];
                            if (semver) {
                                objectList[semver] = obj.Key;
                            }
                        }
                    }
                }
            }
        }
        catch (caught) {
            if (caught instanceof S3ServiceException) {
                this.emitError(new Error(`Error from S3 while listing objects in bucket ${this.bucket} ${caught.name}: ${caught.message}`));
            }
            else {
                this.emitError(caught);
                throw caught;
            }
        }
        // S3 probably failed.
        if (Object.keys(objectList).length === 0) {
            this.emitError(new Error("S3 resulted in no object list"));
            return;
        }
        const sorted = semverSort(Object.keys(objectList));
        const latest = sorted[sorted.length - 1];
        // Latest version, no updating needed
        if (semverGte(app.getVersion(), latest)) {
            this.isChecking = false;
            this.emit("update-not-available");
            return;
        }
        this.emit("update-available");
        this.initTempPath();
        try {
            await this.downloadUpdate(objectList[latest]);
        }
        catch (caught) {
            this.emitError(caught);
            return;
        }
        this.initElectronAutoUpdater();
        this.electronCheckForUpdates();
        this.emit("update-downloaded");
        this.isChecking = false;
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
export default function autoUpdater(region, bucket, prefix, credentials) {
    return new ElectronPrivateS3AutoUpdater(region, bucket, prefix, credentials);
}
//# sourceMappingURL=autoUpdater.js.map