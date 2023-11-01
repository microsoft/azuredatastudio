/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InputValueType } from 'resource-deployment';
import * as azExt from 'az-ext';
import * as vscode from 'vscode';
import { errorListingLogAnalyticsWorkspaces } from '../localizedConstants';

export const licenseTypeVarName = 'AZDATA_NB_VAR_LOG_ANALYTICS_WORKSPACE_NAMES';

// Gets the Log Analytics workspace id from the workspace name.
export async function getWorkspaceIdFromName(triggerFields: { [key: string]: InputValueType }): Promise<string | undefined> {
	try {
		const _azApi = <azExt.IExtension>vscode.extensions.getExtension(azExt.extension.name)?.exports;
		const workspaces = await _azApi.az.monitor.logAnalytics.workspace.list();
		const targetWorkspace = workspaces.stdout.find(workspace => workspace.name === triggerFields[licenseTypeVarName]);
		if (targetWorkspace) {
			return targetWorkspace.customerId;
		} else {
			return undefined;
		}
	} catch (e) {
		vscode.window.showErrorMessage(errorListingLogAnalyticsWorkspaces(e));
		throw e;
	}
}
