/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { DashboardInput } from 'sql/workbench/browser/editor/profiler/dashboardInput';
import { ILogService } from 'vs/platform/log/common/log';

/**
 * Get the current global connection, which is the connection from the active editor, unless OE
 * is focused or there is no such editor, in which case it comes from the OE selection. Returns
 * undefined when there is no such connection.
 *
 * @param objectExplorerService
 * @param connectionManagementService
 * @param workbenchEditorService
 * @param logService
 * @param topLevelOnly If true, only return top-level (i.e. connected) Object Explorer connections instead of database connections when appropriate
*/
export function getCurrentGlobalConnection(objectExplorerService: IObjectExplorerService,
	connectionManagementService: IConnectionManagementService,
	workbenchEditorService: IEditorService,
	logService: ILogService,
	topLevelOnly: boolean = false): IConnectionProfile | undefined {
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
	} else {
		logService.trace('getCurrentGlobalConnection: Object Explorer selection is undefined, finding connection from active editor.');
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
	} else {
		logService.warn('getCurrentGlobalConnection: No active editor found.');
	}

	return connection;
}
