/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import {
	IConnectionManagementService,
	IConnectionCompletionOptions, ConnectionType,
	RunQueryOnConnectionMode, IConnectionResult
} from 'sql/platform/connection/common/connectionManagement';
import { EditDataInput } from 'sql/workbench/parts/editData/browser/editDataInput';
import { IInsightsDialogService } from 'sql/workbench/services/insights/browser/insightsDialogService';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { QueryInput } from 'sql/workbench/parts/query/common/queryInput';
import { DashboardInput } from 'sql/workbench/parts/dashboard/browser/dashboardInput';
import { ProfilerInput } from 'sql/workbench/parts/profiler/browser/profilerInput';

import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IInsightsConfig } from 'sql/platform/dashboard/browser/insightRegistry';

export function replaceConnection(oldUri: string, newUri: string, connectionService: IConnectionManagementService): Promise<IConnectionResult> {
	return new Promise<IConnectionResult>((resolve, reject) => {
		let defaultResult: IConnectionResult = {
			connected: false,
			errorMessage: undefined,
			errorCode: undefined,
			callStack: undefined
		};
		if (connectionService) {
			let connectionProfile = connectionService.getConnectionProfile(oldUri);
			if (connectionProfile) {
				let options: IConnectionCompletionOptions = {
					params: { connectionType: ConnectionType.editor, runQueryOnCompletion: RunQueryOnConnectionMode.none },
					saveTheConnection: false,
					showDashboard: false,
					showConnectionDialogOnError: true,
					showFirewallRuleOnError: true
				};
				connectionService.disconnect(oldUri).then(() => {
					connectionService.connect(connectionProfile, newUri, options).then(result => {
						resolve(result);
					}, connectError => {
						reject(connectError);
					});
				}, disconnectError => {
					reject(disconnectError);
				});

			} else {
				resolve(defaultResult);
			}
		} else {
			resolve(defaultResult);
		}
	});
}

export function openInsight(query: IInsightsConfig, profile: IConnectionProfile, insightDialogService: IInsightsDialogService) {
	insightDialogService.show(query, profile);
}

/**
 * Get the current global connection, which is the connection from the active editor, unless OE
 * is focused or there is no such editor, in which case it comes from the OE selection. Returns
 * undefined when there is no such connection.
 *
 * @param topLevelOnly If true, only return top-level (i.e. connected) Object Explorer connections instead of database connections when appropriate
*/
export function getCurrentGlobalConnection(objectExplorerService: IObjectExplorerService, connectionManagementService: IConnectionManagementService, workbenchEditorService: IEditorService, topLevelOnly: boolean = false): IConnectionProfile {
	let connection: IConnectionProfile;

	let objectExplorerSelection = objectExplorerService.getSelectedProfileAndDatabase();
	if (objectExplorerSelection) {
		let objectExplorerProfile = objectExplorerSelection.profile;
		if (connectionManagementService.isProfileConnected(objectExplorerProfile)) {
			if (objectExplorerSelection.databaseName && !topLevelOnly) {
				connection = objectExplorerProfile.cloneWithDatabase(objectExplorerSelection.databaseName);
			} else {
				connection = objectExplorerProfile;
			}
		}
		if (objectExplorerService.isFocused()) {
			return connection;
		}
	}

	let activeInput = workbenchEditorService.activeEditor;
	if (activeInput) {
		if (activeInput instanceof QueryInput || activeInput instanceof EditDataInput || activeInput instanceof DashboardInput) {
			connection = connectionManagementService.getConnectionProfile(activeInput.uri);
		}
		else if (activeInput instanceof ProfilerInput) {
			connection = activeInput.connection;
		}
	}

	return connection;
}
