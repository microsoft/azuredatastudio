/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { INativeEnvironmentService } from 'vs/platform/environment/common/environment';
import { IExtensionsScannerService, NativeExtensionsScannerService, } from 'vs/platform/extensionManagement/common/extensionsScannerService';
import { IFileService } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { IProductService } from 'vs/platform/product/common/productService';

export class ExtensionsScannerService extends NativeExtensionsScannerService implements IExtensionsScannerService {

	constructor(
		@IFileService fileService: IFileService,
		@ILogService logService: ILogService,
		@INativeEnvironmentService environmentService: INativeEnvironmentService,
		@IProductService productService: IProductService,
	) {
		super(
			URI.file(environmentService.builtinExtensionsPath),
			URI.file(environmentService.extensionsPath),
			environmentService.userHome,
			URI.file(environmentService.userDataPath),
			fileService, logService, environmentService, productService);
	}

}
