/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import { ExtHostAzureBlobShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';
import { IExtHostExtensionService } from 'vs/workbench/api/common/extHostExtensionService';

export class ExtHostAzureBlob extends ExtHostAzureBlobShape {
	constructor(@IExtHostExtensionService private _extHostExtensionService: IExtHostExtensionService,) {
		super();
	}

	public override $createSas(connectionUri: string, blobContainerUri: string, blobStorageKey: string, storageAccountName: string, expirationDate: string): Thenable<mssql.CreateSasResponse> {
		const api = this.getApi();
		return api.azureBlob.createSas(connectionUri, blobContainerUri, blobStorageKey, storageAccountName, expirationDate);
	}

	private getApi(): mssql.IExtension {
		return this._extHostExtensionService.getExtensionExports(new ExtensionIdentifier(mssql.extension.name)) as mssql.IExtension;
	}
}
