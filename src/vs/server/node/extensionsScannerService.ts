/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { joinPath } from 'vs/base/common/resources';
import { URI } from 'vs/base/common/uri';
import { INativeEnvironmentService } from 'vs/platform/environment/common/environment';
import { AbstractExtensionsScannerService, IExtensionsScannerService, Translations } from 'vs/platform/extensionManagement/common/extensionsScannerService';
import { MANIFEST_CACHE_FOLDER } from 'vs/platform/extensions/common/extensions';
import { IFileService } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { IProductService } from 'vs/platform/product/common/productService';
import { getNLSConfiguration, InternalNLSConfiguration } from 'vs/server/node/remoteLanguagePacks';

export class ExtensionsScannerService extends AbstractExtensionsScannerService implements IExtensionsScannerService {

	constructor(
		@IFileService fileService: IFileService,
		@ILogService logService: ILogService,
		@INativeEnvironmentService private readonly nativeEnvironmentService: INativeEnvironmentService,
		@IProductService productService: IProductService,
	) {
		super(
			URI.file(nativeEnvironmentService.builtinExtensionsPath),
			URI.file(nativeEnvironmentService.extensionsPath),
			joinPath(nativeEnvironmentService.userHome, '.vscode-oss-dev', 'extensions', 'control.json'),
			joinPath(URI.file(nativeEnvironmentService.userDataPath), MANIFEST_CACHE_FOLDER),
			fileService, logService, nativeEnvironmentService, productService);
	}

	protected async getTranslations(language: string): Promise<Translations> {
		const config = await getNLSConfiguration(language, this.nativeEnvironmentService.userDataPath);
		if (InternalNLSConfiguration.is(config)) {
			try {
				const content = await this.fileService.readFile(URI.file(config._translationsConfigFile));
				return JSON.parse(content.value.toString());
			} catch (err) { /* Ignore error */ }
		}
		return Object.create(null);
	}

}
