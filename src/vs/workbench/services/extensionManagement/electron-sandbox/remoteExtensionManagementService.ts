/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IChannel } from 'vs/base/parts/ipc/common/ipc';
import { ILocalExtension, IGalleryExtension, IExtensionGalleryService, InstallOperation, InstallOptions, InstallVSIXOptions, ExtensionManagementError, ExtensionManagementErrorCode } from 'vs/platform/extensionManagement/common/extensionManagement';
import { URI } from 'vs/base/common/uri';
import { ExtensionType, IExtensionManifest } from 'vs/platform/extensions/common/extensions';
import { areSameExtensions } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import { ILogService } from 'vs/platform/log/common/log';
import { toErrorMessage } from 'vs/base/common/errorMessage';
import { isNonEmptyArray } from 'vs/base/common/arrays';
import { CancellationToken } from 'vs/base/common/cancellation';
import { localize } from 'vs/nls';
import { IProductService } from 'vs/platform/product/common/productService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IExtensionManagementServer } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { Promises } from 'vs/base/common/async';
import { IExtensionManifestPropertiesService } from 'vs/workbench/services/extensions/common/extensionManifestPropertiesService';
import { IFileService } from 'vs/platform/files/common/files';
import { RemoteExtensionManagementService } from 'vs/workbench/services/extensionManagement/common/remoteExtensionManagementService';
import { IUserDataProfilesService } from 'vs/platform/userDataProfile/common/userDataProfile';
import { IUserDataProfileService } from 'vs/workbench/services/userDataProfile/common/userDataProfile';
import { IRemoteUserDataProfilesService } from 'vs/workbench/services/userDataProfile/common/remoteUserDataProfiles';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';

export class NativeRemoteExtensionManagementService extends RemoteExtensionManagementService {

	constructor(
		channel: IChannel,
		private readonly localExtensionManagementServer: IExtensionManagementServer,
		@IUserDataProfileService userDataProfileService: IUserDataProfileService,
		@IUserDataProfilesService userDataProfilesService: IUserDataProfilesService,
		@IRemoteUserDataProfilesService remoteUserDataProfilesService: IRemoteUserDataProfilesService,
		@IUriIdentityService uriIdentityService: IUriIdentityService,
		@ILogService private readonly logService: ILogService,
		@IExtensionGalleryService private readonly galleryService: IExtensionGalleryService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IProductService private readonly productService: IProductService,
		@IFileService private readonly fileService: IFileService,
		@IExtensionManifestPropertiesService private readonly extensionManifestPropertiesService: IExtensionManifestPropertiesService,
	) {
		super(channel, userDataProfileService, userDataProfilesService, remoteUserDataProfilesService, uriIdentityService);
	}

	override async install(vsix: URI, options?: InstallVSIXOptions): Promise<ILocalExtension> {
		const local = await super.install(vsix, options);
		await this.installUIDependenciesAndPackedExtensions(local);
		return local;
	}

	override async installFromGallery(extension: IGalleryExtension, installOptions?: InstallOptions): Promise<ILocalExtension> {
		const local = await this.doInstallFromGallery(extension, installOptions);
		await this.installUIDependenciesAndPackedExtensions(local);
		return local;
	}

	private async doInstallFromGallery(extension: IGalleryExtension, installOptions?: InstallOptions): Promise<ILocalExtension> {
		if (this.configurationService.getValue('remote.downloadExtensionsLocally')) {
			return this.downloadAndInstall(extension, installOptions || {});
		}
		try {
			return await super.installFromGallery(extension, installOptions);
		} catch (error) {
			switch (error.name) {
				case ExtensionManagementErrorCode.Download:
				case ExtensionManagementErrorCode.Internal:
					try {
						this.logService.error(`Error while installing '${extension.identifier.id}' extension in the remote server.`, toErrorMessage(error));
						return await this.downloadAndInstall(extension, installOptions || {});
					} catch (e) {
						this.logService.error(e);
						throw e;
					}
				default:
					this.logService.debug('Remote Install Error Name', error.name);
					throw error;
			}
		}
	}

	private async downloadAndInstall(extension: IGalleryExtension, installOptions: InstallOptions): Promise<ILocalExtension> {
		this.logService.info(`Downloading the '${extension.identifier.id}' extension locally and install`);
		const compatible = await this.checkAndGetCompatible(extension, !!installOptions.installPreReleaseVersion);
		installOptions = { ...installOptions, donotIncludePackAndDependencies: true };
		const installed = await this.getInstalled(ExtensionType.User);
		const workspaceExtensions = await this.getAllWorkspaceDependenciesAndPackedExtensions(compatible, CancellationToken.None);
		if (workspaceExtensions.length) {
			this.logService.info(`Downloading the workspace dependencies and packed extensions of '${compatible.identifier.id}' locally and install`);
			for (const workspaceExtension of workspaceExtensions) {
				await this.downloadCompatibleAndInstall(workspaceExtension, installed, installOptions);
			}
		}
		return await this.downloadCompatibleAndInstall(compatible, installed, installOptions);
	}

	private async downloadCompatibleAndInstall(extension: IGalleryExtension, installed: ILocalExtension[], installOptions: InstallOptions): Promise<ILocalExtension> {
		const compatible = await this.checkAndGetCompatible(extension, !!installOptions.installPreReleaseVersion);
		this.logService.trace('Downloading extension:', compatible.identifier.id);
		const location = await this.localExtensionManagementServer.extensionManagementService.download(compatible, installed.filter(i => areSameExtensions(i.identifier, compatible.identifier))[0] ? InstallOperation.Update : InstallOperation.Install, !!installOptions.donotVerifySignature);
		this.logService.info('Downloaded extension:', compatible.identifier.id, location.path);
		try {
			const local = await super.install(location, installOptions);
			this.logService.info(`Successfully installed '${compatible.identifier.id}' extension`);
			return local;
		} finally {
			try {
				await this.fileService.del(location);
			} catch (error) {
				this.logService.error(error);
			}
		}
	}

	private async checkAndGetCompatible(extension: IGalleryExtension, includePreRelease: boolean): Promise<IGalleryExtension> {
		const targetPlatform = await this.getTargetPlatform();
		let compatibleExtension: IGalleryExtension | null = null;

		if (extension.hasPreReleaseVersion && extension.properties.isPreReleaseVersion !== includePreRelease) {
			compatibleExtension = (await this.galleryService.getExtensions([{ ...extension.identifier, preRelease: includePreRelease }], { targetPlatform, compatible: true }, CancellationToken.None))[0] || null;
		}

		if (!compatibleExtension && await this.galleryService.isExtensionCompatible(extension, includePreRelease, targetPlatform)) {
			compatibleExtension = extension;
		}

		if (!compatibleExtension) {
			compatibleExtension = await this.galleryService.getCompatibleExtension(extension, includePreRelease, targetPlatform);
		}

		if (!compatibleExtension) {
			/** If no compatible release version is found, check if the extension has a release version or not and throw relevant error */
			if (!includePreRelease && extension.properties.isPreReleaseVersion && (await this.galleryService.getExtensions([extension.identifier], CancellationToken.None))[0]) {
				throw new ExtensionManagementError(localize('notFoundReleaseExtension', "Can't install release version of '{0}' extension because it has no release version.", extension.identifier.id), ExtensionManagementErrorCode.ReleaseVersionNotFound);
			}
			throw new ExtensionManagementError(localize('notFoundCompatibleDependency', "Can't install '{0}' extension because it is not compatible with the current version of {1} (version {2}).", extension.identifier.id, this.productService.nameLong, this.productService.version), ExtensionManagementErrorCode.Incompatible);
		}

		return compatibleExtension;
	}

	private async installUIDependenciesAndPackedExtensions(local: ILocalExtension): Promise<void> {
		const uiExtensions = await this.getAllUIDependenciesAndPackedExtensions(local.manifest, CancellationToken.None);
		const installed = await this.localExtensionManagementServer.extensionManagementService.getInstalled();
		const toInstall = uiExtensions.filter(e => installed.every(i => !areSameExtensions(i.identifier, e.identifier)));
		if (toInstall.length) {
			this.logService.info(`Installing UI dependencies and packed extensions of '${local.identifier.id}' locally`);
			await Promises.settled(toInstall.map(d => this.localExtensionManagementServer.extensionManagementService.installFromGallery(d)));
		}
	}

	private async getAllUIDependenciesAndPackedExtensions(manifest: IExtensionManifest, token: CancellationToken): Promise<IGalleryExtension[]> {
		const result = new Map<string, IGalleryExtension>();
		const extensions = [...(manifest.extensionPack || []), ...(manifest.extensionDependencies || [])];
		await this.getDependenciesAndPackedExtensionsRecursively(extensions, result, true, token);
		return [...result.values()];
	}

	private async getAllWorkspaceDependenciesAndPackedExtensions(extension: IGalleryExtension, token: CancellationToken): Promise<IGalleryExtension[]> {
		const result = new Map<string, IGalleryExtension>();
		result.set(extension.identifier.id.toLowerCase(), extension);
		const manifest = await this.galleryService.getManifest(extension, token);
		if (manifest) {
			const extensions = [...(manifest.extensionPack || []), ...(manifest.extensionDependencies || [])];
			await this.getDependenciesAndPackedExtensionsRecursively(extensions, result, false, token);
		}
		result.delete(extension.identifier.id);
		return [...result.values()];
	}

	private async getDependenciesAndPackedExtensionsRecursively(toGet: string[], result: Map<string, IGalleryExtension>, uiExtension: boolean, token: CancellationToken): Promise<void> {
		if (toGet.length === 0) {
			return Promise.resolve();
		}

		const extensions = await this.galleryService.getExtensions(toGet.map(id => ({ id })), token);
		const manifests = await Promise.all(extensions.map(e => this.galleryService.getManifest(e, token)));
		const extensionsManifests: IExtensionManifest[] = [];
		for (let idx = 0; idx < extensions.length; idx++) {
			const extension = extensions[idx];
			const manifest = manifests[idx];
			if (manifest && this.extensionManifestPropertiesService.prefersExecuteOnUI(manifest) === uiExtension) {
				result.set(extension.identifier.id.toLowerCase(), extension);
				extensionsManifests.push(manifest);
			}
		}
		toGet = [];
		for (const extensionManifest of extensionsManifests) {
			if (isNonEmptyArray(extensionManifest.extensionDependencies)) {
				for (const id of extensionManifest.extensionDependencies) {
					if (!result.has(id.toLowerCase())) {
						toGet.push(id);
					}
				}
			}
			if (isNonEmptyArray(extensionManifest.extensionPack)) {
				for (const id of extensionManifest.extensionPack) {
					if (!result.has(id.toLowerCase())) {
						toGet.push(id);
					}
				}
			}
		}
		return this.getDependenciesAndPackedExtensionsRecursively(toGet, result, uiExtension, token);
	}
}
