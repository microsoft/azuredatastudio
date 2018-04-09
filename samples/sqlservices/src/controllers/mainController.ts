/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as Utils from '../utils';
import * as vscode from 'vscode';
import { ApiWrapper } from '../apiWrapper';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {

	constructor(protected context: vscode.ExtensionContext, protected apiWrapper?: ApiWrapper) {

	}

	// PUBLIC METHODS //////////////////////////////////////////////////////

	public dispose(): void {
		this.deactivate();
	}

	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
		Utils.logDebug('Main controller deactivated');
	}

	public activate(): Promise<boolean> {
		sqlops.dashboard.registerModelViewProvider('sqlservices', async view => {
			let flexModel = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row'
			}).withItems([
				// 1st child panel with N cards
				view.modelBuilder.flexContainer()
					.withLayout({ flexFlow: 'column'})
					.withItems([
						view.modelBuilder.card().withLabelValue('label1', 'value1')
						.withActions([{ label: 'action', taskId: 'sqlservices.clickTask'}])
					]),
				// 2nd child panel with N cards
				view.modelBuilder.flexContainer()
					.withLayout({ flexFlow: 'column'})
					.withItems([
						view.modelBuilder.card().withLabelValue('label2', 'value2')
						.withActions([{ label: 'action', taskId: 'sqlservices.clickTask'}])
					])
			], { flex: '0 1 50%' });

			await view.initializeModel(flexModel);
		});

		sqlops.tasks.registerTask('sqlservices.clickTask', (profile) => {
			vscode.window.showInformationMessage(`Clicked from profile ${profile.serverName}.${profile.databaseName}`);
		});

		return Promise.resolve(true);
	}
}

