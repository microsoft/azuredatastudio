/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb } from 'sqlops';

import { localize } from 'vs/nls';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { IDefaultConnection, notebookConstants, INotebookModelOptions } from 'sql/parts/notebook/models/modelInterfaces';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';

export class SparkMagicContexts {

	public static get DefaultContext(): IDefaultConnection {
		let defaultConnection: IConnectionProfile = <any>{
			providerName: 'MSSQL',
			id: '-1',
			serverName: localize('selectConnection', 'Select connection')
		};

		return {
			// default context if no other contexts are applicable
			defaultConnection: defaultConnection,
			otherConnections: [defaultConnection]
		};
	}

	public static get LocalContext(): IDefaultConnection {
		let localConnection: IConnectionProfile = <any>{
			providerName: 'MSSQL',
			id: '-1',
			serverName: localize('localhost', 'Localhost')
		};

		return {
			// default context if no other contexts are applicable
			defaultConnection: localConnection,
			otherConnections: [localConnection]
		};
	}

	/**
	 * Get all of the applicable contexts for a given kernel
	 * @param apiWrapper ApiWrapper
	 * @param kernelChangedArgs kernel changed args (both old and new kernel info)
	 * @param profile current connection profile
	 */
	public static async getContextsForKernel(connectionService: IConnectionManagementService, connProviderIds: string[], kernelChangedArgs?: nb.IKernelChangedArgs, profile?: IConnectionProfile): Promise<IDefaultConnection> {
		let connections: IDefaultConnection = this.DefaultContext;
		if (!profile) {
			if (!kernelChangedArgs || !kernelChangedArgs.newValue ||
				(kernelChangedArgs.oldValue && kernelChangedArgs.newValue.id === kernelChangedArgs.oldValue.id)) {
				// nothing to do, kernels are the same or new kernel is undefined
				return connections;
			}
		}
		if (kernelChangedArgs && kernelChangedArgs.newValue && kernelChangedArgs.newValue.name) {
			if (connProviderIds !== []) {
				connections = await this.getActiveContexts(connectionService, connProviderIds, profile);
			}
		} else {
			connections = await this.getActiveContexts(connectionService, connProviderIds, profile);
		}
		return connections;
	}

	/**
	 * Get all active contexts and sort them
	 * @param apiWrapper ApiWrapper
	 * @param profile current connection profile
	 */
	public static async getActiveContexts(connectionService: IConnectionManagementService, connProviderIds: string[], profile: IConnectionProfile): Promise<IDefaultConnection> {
		let defaultConnection: IConnectionProfile = SparkMagicContexts.DefaultContext.defaultConnection;
		let activeConnections: IConnectionProfile[] = await connectionService.getActiveConnections();
		// If no connections exist, only show 'n/a'
		if (activeConnections && activeConnections.length > 0) {
			activeConnections = activeConnections.filter(conn => conn.id !== '-1');
		}
		if (activeConnections.length === 0) {
			if (connProviderIds.length === 0) {
				return SparkMagicContexts.LocalContext;
			}
			return SparkMagicContexts.DefaultContext;
		}

		// If launched from the right click or server dashboard, connection profile data exists, so use that as default
		// if (profile && profile.options) {
		// 	let profileConnection = activeConnections.filter(conn => conn.serverName === profile.serverName);
		// 	if (profileConnection) {
		// 		let connections = profileConnection.filter(connection => connection.providerName in connProviderIds);
		// 		if (connections && connections.length > 0) {
		// 			defaultConnection = connections[0];
		// 		}
		// 	}
		// } else {
		if (activeConnections.length > 0) {
			let connections = activeConnections.filter(connection => {
				return connProviderIds.includes(connection.providerName);
			});
			if (connections && connections.length > 0) {
				defaultConnection = connections[0];
			}
			activeConnections = [];
			connections.forEach(connection => activeConnections.push(connection));
		}
		if (defaultConnection === SparkMagicContexts.DefaultContext.defaultConnection) {
			defaultConnection = <IConnectionProfile><any>{
				providerName: 'SQL',
				id: '-2',
				serverName: localize('addConnection', 'Add new connection')
			};
			activeConnections.push(defaultConnection);
		}

		return {
			otherConnections: activeConnections,
			defaultConnection: defaultConnection
		};
	}

	/**
	 *
	 * @param specs kernel specs (comes from session manager)
	 * @param connectionInfo connection profile
	 * @param savedKernelInfo kernel info loaded from
	 */
	public static getDefaultKernel(specs: nb.IAllKernels, connectionInfo: IConnectionProfile, savedKernelInfo: nb.IKernelInfo, notificationService: INotificationService): nb.IKernelSpec {
		let foundSavedKernelInSpecs;
		let defaultKernel;
		if (specs) {
			defaultKernel = specs.kernels.find((kernel) => kernel.name === specs.defaultKernel);
			if (savedKernelInfo) {
				foundSavedKernelInSpecs = specs.kernels.find((kernel) => kernel.name === savedKernelInfo.name);
			}
		}
		if (specs && connectionInfo) {
			// set default kernel to default spark kernel if profile exists
			// otherwise, set default to kernel info loaded from existing file
			defaultKernel = !foundSavedKernelInSpecs ? specs.kernels.find((spec) => spec.name === notebookConstants.SQL) : foundSavedKernelInSpecs;
		} else {
			// Handle kernels
			// This needs to check if there's a valid connection provider associated with the notebook provider; if there is one and no connections
			// then we should show the message
			if (savedKernelInfo && savedKernelInfo.name.toLowerCase().indexOf('spark') > -1) {
				notificationService.warn(localize('kernelRequiresConnection', 'Cannot use kernel {0} as no connection is active. The default kernel of {1} will be used instead.', savedKernelInfo.display_name, defaultKernel.display_name));
			}
		}

		// If no default kernel specified (should never happen), default to SQL
		if (!defaultKernel) {
			defaultKernel = {
				name: notebookConstants.SQL,
				display_name: notebookConstants.SQL
			};
		}
		return defaultKernel;
	}
}

export interface IKernelJupyterID {
	id: string;
	jupyterId: string;
}
