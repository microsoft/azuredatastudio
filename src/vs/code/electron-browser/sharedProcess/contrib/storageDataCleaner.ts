/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INativeEnvironmentService } from 'vs/platform/environment/common/environment';
import { join } from 'vs/base/common/path';
import { Promises } from 'vs/base/node/pfs';
import { onUnexpectedError } from 'vs/base/common/errors';
import { Disposable } from 'vs/base/common/lifecycle';
import { IBackupWorkspacesFormat } from 'vs/platform/backup/node/backup';
import { RunOnceScheduler } from 'vs/base/common/async';
import { ILogService } from 'vs/platform/log/common/log';

export class StorageDataCleaner extends Disposable {

	// Workspace/Folder storage names are MD5 hashes (128bits / 4 due to hex presentation)
	private static readonly NON_EMPTY_WORKSPACE_ID_LENGTH = 128 / 4;

	constructor(
		private readonly backupWorkspacesPath: string,
		@INativeEnvironmentService private readonly environmentService: INativeEnvironmentService,
		@ILogService private readonly logService: ILogService
	) {
		super();

		const scheduler = this._register(new RunOnceScheduler(() => {
			this.cleanUpStorage();
		}, 30 * 1000 /* after 30s */));
		scheduler.schedule();
	}

	private async cleanUpStorage(): Promise<void> {
		this.logService.info('[storage cleanup]: Starting to clean up storage folders.');

		try {

			// Leverage the backup workspace file to find out which empty workspace is currently in use to
			// determine which empty workspace storage can safely be deleted
			const contents = await Promises.readFile(this.backupWorkspacesPath, 'utf8');

			const workspaces = JSON.parse(contents) as IBackupWorkspacesFormat;
			const emptyWorkspaces = workspaces.emptyWorkspaceInfos.map(emptyWorkspace => emptyWorkspace.backupFolder);

			// Read all workspace storage folders that exist
			const storageFolders = await Promises.readdir(this.environmentService.workspaceStorageHome.fsPath);
			await Promise.all(storageFolders.map(async storageFolder => {
				if (storageFolder.length === StorageDataCleaner.NON_EMPTY_WORKSPACE_ID_LENGTH) {
					return;
				}

				if (emptyWorkspaces.indexOf(storageFolder) === -1) {
					this.logService.info(`[storage cleanup]: Deleting storage folder ${storageFolder}.`);

					await Promises.rm(join(this.environmentService.workspaceStorageHome.fsPath, storageFolder));
				}
			}));
		} catch (error) {
			onUnexpectedError(error);
		}
	}
}
