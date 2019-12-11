/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { localize } from 'vs/nls';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';


export class NotebookContexts {

	public static get DefaultContext(): ConnectionProfile {
		return <any>{
			providerName: mssqlProviderName,
			id: '-1',
			serverName: localize('selectConnection', "Select Connection")
		};
	}

	public static get LocalContext(): ConnectionProfile {
		return <any>{
			providerName: mssqlProviderName,
			id: '-1',
			serverName: localize('localhost', "localhost")
		};
	}

	/**
	 * Get the applicable context for a given kernel
	 * @param context current connection profile
	 * @param connProviderIds array of connection provider ids applicable for a kernel
	 */
	public static getContextForKernel(context: ConnectionProfile, connProviderIds: string[]): ConnectionProfile {
		// If no connection provider ids exist for a given kernel, the attach to should show localhost
		if (connProviderIds.length === 0) {
			return NotebookContexts.LocalContext;
		}
		if (context && context.providerName && connProviderIds.filter(p => p === context.providerName).length > 0) {
			return context;
		}
		return NotebookContexts.DefaultContext;
	}

}
