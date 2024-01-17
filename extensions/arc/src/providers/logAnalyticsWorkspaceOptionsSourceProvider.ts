/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azExt from 'az-ext';
import * as rd from 'resource-deployment';
import * as vscode from 'vscode';
import { errorListingLogAnalyticsWorkspaces } from '../localizedConstants';

/**
 * Class that provides options sources for Log Analytics workspace names
 */
export class LogAnalyticsWorkspaceOptionsSourceProvider implements rd.IOptionsSourceProvider {
	readonly id = 'arc.logAnalyticsWorkspaceNames';
	private readonly _azApi: azExt.IExtension;

	constructor() {
		this._azApi = <azExt.IExtension>vscode.extensions.getExtension(azExt.extension.name)?.exports;
	}

	public async getOptions(): Promise<string[]> {
		try {
			const workspacesListResult = await this._azApi.az.monitor.logAnalytics.workspace.list();
			return workspacesListResult.stdout.map(workspace => workspace.name);
		} catch (err) {
			vscode.window.showErrorMessage(errorListingLogAnalyticsWorkspaces(err));
			throw err;
		}
	}
}
