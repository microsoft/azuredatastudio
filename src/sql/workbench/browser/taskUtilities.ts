/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { DashboardInput } from 'sql/workbench/browser/editor/profiler/dashboardInput';

/**
 * Get the current global connection, which is the connection from the active editor, unless OE
 * is focused or there is no such editor, in which case it comes from the OE selection. Returns
 * undefined when there is no such connection.
 *
 * @param topLevelOnly If true, only return top-level (i.e. connected) Object Explorer connections instead of database connections when appropriate
*/
export function getCurrentGlobalConnection(objectExplorerService: IObjectExplorerService, connectionManagementService: IConnectionManagementService, workbenchEditorService: IEditorService, topLevelOnly: boolean = false): IConnectionProfile | undefined {
	let connection: IConnectionProfile | undefined;
	// object Explorer Connection
	let objectExplorerSelection = objectExplorerService.getSelectedProfileAndDatabase();
	if (objectExplorerSelection) {
		if (objectExplorerSelection.profile) {
			if (connectionManagementService.isProfileConnected(objectExplorerSelection.profile)) {
				if (objectExplorerSelection.databaseName && !topLevelOnly) {
					connection = objectExplorerSelection.profile.cloneWithDatabase(objectExplorerSelection.databaseName);
				} else {
					connection = objectExplorerSelection.profile;
				}
			}
		}
		if (objectExplorerService.isFocused()) {
			return connection;
		}
	}

	let activeInput = workbenchEditorService.activeEditor;
	if (activeInput) {
		// dashboard Connection
		if (activeInput instanceof DashboardInput && activeInput.uri) {
			connection = connectionManagementService.getConnectionProfile(activeInput.uri);
		} else if (activeInput.resource) {
			// editor Connection
			connection = connectionManagementService.getConnectionProfile(activeInput.resource.toString(true));
		}
	}

	return connection;
}
