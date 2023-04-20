/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage } from 'vs/base/common/errors';
import { URI } from 'vs/base/common/uri';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IExtensionStorageService } from 'vs/platform/extensionManagement/common/extensionStorage';
import { FileSystemProviderError, FileSystemProviderErrorCode, IFileService } from 'vs/platform/files/common/files';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';
import { IUserDataProfilesService } from 'vs/platform/userDataProfile/common/userDataProfile';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';

/**
 * An extension storage has following
 * 	- State: Stored using storage service with extension id as key and state as value.
 *  - Resources: Stored under a location scoped to the extension.
 */
export async function migrateExtensionStorage(fromExtensionId: string, toExtensionId: string, global: boolean, instantionService: IInstantiationService): Promise<void> {
	return instantionService.invokeFunction(async serviceAccessor => {
		const environmentService = serviceAccessor.get(IEnvironmentService);
		const userDataProfilesService = serviceAccessor.get(IUserDataProfilesService);
		const extensionStorageService = serviceAccessor.get(IExtensionStorageService);
		const storageService = serviceAccessor.get(IStorageService);
		const uriIdentityService = serviceAccessor.get(IUriIdentityService);
		const fileService = serviceAccessor.get(IFileService);
		const workspaceContextService = serviceAccessor.get(IWorkspaceContextService);
		const logService = serviceAccessor.get(ILogService);
		const storageMigratedKey = `extensionStorage.migrate.${fromExtensionId}-${toExtensionId}`;
		const migrateLowerCaseStorageKey = fromExtensionId.toLowerCase() === toExtensionId.toLowerCase() ? `extension.storage.migrateFromLowerCaseKey.${fromExtensionId.toLowerCase()}` : undefined;

		if (fromExtensionId === toExtensionId) {
			return;
		}

		const getExtensionStorageLocation = (extensionId: string, global: boolean): URI => {
			if (global) {
				return uriIdentityService.extUri.joinPath(userDataProfilesService.defaultProfile.globalStorageHome, extensionId.toLowerCase() /* Extension id is lower cased for global storage */);
			}
			return uriIdentityService.extUri.joinPath(environmentService.workspaceStorageHome, workspaceContextService.getWorkspace().id, extensionId);
		};

		const storageScope = global ? StorageScope.PROFILE : StorageScope.WORKSPACE;
		if (!storageService.getBoolean(storageMigratedKey, storageScope, false) && !(migrateLowerCaseStorageKey && storageService.getBoolean(migrateLowerCaseStorageKey, storageScope, false))) {
			logService.info(`Migrating ${global ? 'global' : 'workspace'} extension storage from ${fromExtensionId} to ${toExtensionId}...`);
			// Migrate state
			const value = extensionStorageService.getExtensionState(fromExtensionId, global);
			if (value) {
				extensionStorageService.setExtensionState(toExtensionId, value, global);
				extensionStorageService.setExtensionState(fromExtensionId, undefined, global);
			}

			// Migrate stored files
			const fromPath = getExtensionStorageLocation(fromExtensionId, global);
			const toPath = getExtensionStorageLocation(toExtensionId, global);
			if (!uriIdentityService.extUri.isEqual(fromPath, toPath)) {
				try {
					await fileService.move(fromPath, toPath, true);
				} catch (error) {
					if ((<FileSystemProviderError>error).code !== FileSystemProviderErrorCode.FileNotFound) {
						logService.info(`Error while migrating ${global ? 'global' : 'workspace'} file storage from '${fromExtensionId}' to '${toExtensionId}'`, getErrorMessage(error));
					}
				}
			}
			logService.info(`Migrated ${global ? 'global' : 'workspace'} extension storage from ${fromExtensionId} to ${toExtensionId}`);
			storageService.store(storageMigratedKey, true, storageScope, StorageTarget.MACHINE);
		}
	});
}
