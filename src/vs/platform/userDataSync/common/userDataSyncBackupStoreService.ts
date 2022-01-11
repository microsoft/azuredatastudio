/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Promises } from 'vs/base/common/async';
import { VSBuffer } from 'vs/base/common/buffer';
import { toLocalISOString } from 'vs/base/common/date';
import { Disposable } from 'vs/base/common/lifecycle';
import { joinPath } from 'vs/base/common/resources';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IFileService, IFileStat } from 'vs/platform/files/common/files';
import { ALL_SYNC_RESOURCES, IResourceRefHandle, IUserDataSyncBackupStoreService, IUserDataSyncLogService, SyncResource } from 'vs/platform/userDataSync/common/userDataSync';

export class UserDataSyncBackupStoreService extends Disposable implements IUserDataSyncBackupStoreService {

	_serviceBrand: any;

	constructor(
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@IFileService private readonly fileService: IFileService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IUserDataSyncLogService private readonly logService: IUserDataSyncLogService,
	) {
		super();
		ALL_SYNC_RESOURCES.forEach(resourceKey => this.cleanUpBackup(resourceKey));
	}

	async getAllRefs(resource: SyncResource): Promise<IResourceRefHandle[]> {
		const folder = joinPath(this.environmentService.userDataSyncHome, resource);
		const stat = await this.fileService.resolve(folder);
		if (stat.children) {
			const all = stat.children.filter(stat => stat.isFile && /^\d{8}T\d{6}(\.json)?$/.test(stat.name)).sort().reverse();
			return all.map(stat => ({
				ref: stat.name,
				created: this.getCreationTime(stat)
			}));
		}
		return [];
	}

	async resolveContent(resource: SyncResource, ref?: string): Promise<string | null> {
		if (!ref) {
			const refs = await this.getAllRefs(resource);
			if (refs.length) {
				ref = refs[refs.length - 1].ref;
			}
		}
		if (ref) {
			const file = joinPath(this.environmentService.userDataSyncHome, resource, ref);
			const content = await this.fileService.readFile(file);
			return content.value.toString();
		}
		return null;
	}

	async backup(resourceKey: SyncResource, content: string): Promise<void> {
		const folder = joinPath(this.environmentService.userDataSyncHome, resourceKey);
		const resource = joinPath(folder, `${toLocalISOString(new Date()).replace(/-|:|\.\d+Z$/g, '')}.json`);
		try {
			await this.fileService.writeFile(resource, VSBuffer.fromString(content));
		} catch (e) {
			this.logService.error(e);
		}
		try {
			this.cleanUpBackup(resourceKey);
		} catch (e) { /* Ignore */ }
	}

	private async cleanUpBackup(resource: SyncResource): Promise<void> {
		const folder = joinPath(this.environmentService.userDataSyncHome, resource);
		try {
			try {
				if (!(await this.fileService.exists(folder))) {
					return;
				}
			} catch (e) {
				return;
			}
			const stat = await this.fileService.resolve(folder);
			if (stat.children) {
				const all = stat.children.filter(stat => stat.isFile && /^\d{8}T\d{6}(\.json)?$/.test(stat.name)).sort();
				const backUpMaxAge = 1000 * 60 * 60 * 24 * (this.configurationService.getValue<number>('sync.localBackupDuration') || 30 /* Default 30 days */);
				let toDelete = all.filter(stat => Date.now() - this.getCreationTime(stat) > backUpMaxAge);
				const remaining = all.length - toDelete.length;
				if (remaining < 10) {
					toDelete = toDelete.slice(10 - remaining);
				}
				await Promises.settled(toDelete.map(async stat => {
					this.logService.info('Deleting from backup', stat.resource.path);
					await this.fileService.del(stat.resource);
				}));
			}
		} catch (e) {
			this.logService.error(e);
		}
	}

	private getCreationTime(stat: IFileStat) {
		return stat.ctime || new Date(
			parseInt(stat.name.substring(0, 4)),
			parseInt(stat.name.substring(4, 6)) - 1,
			parseInt(stat.name.substring(6, 8)),
			parseInt(stat.name.substring(9, 11)),
			parseInt(stat.name.substring(11, 13)),
			parseInt(stat.name.substring(13, 15))
		).getTime();
	}
}
