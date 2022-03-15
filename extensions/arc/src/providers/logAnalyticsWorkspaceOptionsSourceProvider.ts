/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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
		let workspaceNames: string[] = [];
		await Promise.resolve(
			this._azApi.az.monitor.logAnalytics.workspace.list().then(result => {
				result.stdout.forEach(workspace => {
					workspaceNames.push(workspace.name);
				});
			}).catch(err => {
				vscode.window.showErrorMessage(errorListingLogAnalyticsWorkspaces(err));
				throw err;
			})
		);
		return workspaceNames;
	}
}
