/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { deepClone } from 'vs/base/common/objects';


// Concrete implementation of the connection.ConnectionProfile interface

/**
 * A concrete implementation of a RPC friendly ConnectionProfile
 */
export class RpcConnectionProfile implements azdata.connection.ConnectionProfile {
	providerId: string;
	connectionId: string;
	connectionName: string;
	serverName: string;
	databaseName: string;
	userName: string;
	password: string;
	authenticationType: string;
	savePassword: boolean;
	groupFullName: string;
	groupId: string;
	saveProfile: boolean;
	azureTenantId?: string | undefined;
	options: { [name: string]: any };

	public constructor(
		model: azdata.IConnectionProfile, deepCopyOptions: boolean = false) {
		if (model) {
			this.providerId = model.providerName;
			this.connectionId = model.id;
			this.connectionName = model.connectionName;
			this.serverName = model.serverName;
			this.databaseName = model.databaseName;
			this.userName = model.userName;
			this.password = model.password;
			this.authenticationType = model.authenticationType;
			this.savePassword = model.savePassword;
			this.groupFullName = model.groupFullName;
			this.groupId = model.id
			this.saveProfile = model.saveProfile;
			this.azureTenantId = model.azureTenantId;
			this.options = deepCopyOptions ? deepClone(model.options) : model.options;
		}
		else {
			return undefined;
		}
	}
}
