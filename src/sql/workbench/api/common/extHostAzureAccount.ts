/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azurecore from 'azurecore';
import { ExtHostAzureAccountShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';
import { IExtHostExtensionService } from 'vs/workbench/api/common/extHostExtensionService';

export class ExtHostAzureAccount extends ExtHostAzureAccountShape {

	constructor(@IExtHostExtensionService private _extHostExtensionService: IExtHostExtensionService,) {
		super();
	}

	public override $getSubscriptions(account: azurecore.AzureAccount, ignoreErrors?: boolean, selectedOnly?: boolean): Thenable<azurecore.GetSubscriptionsResult> {
		const api = this._extHostExtensionService.getExtensionExports(new ExtensionIdentifier(azurecore.extension.name)) as azurecore.IExtension;
		return api.getSubscriptions(account, ignoreErrors, selectedOnly);
	}
}

