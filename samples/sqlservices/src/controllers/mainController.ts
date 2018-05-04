/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as Utils from '../utils';
import * as vscode from 'vscode';
import SplitPropertiesPanel from './splitPropertiesPanel';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {

	constructor(protected context: vscode.ExtensionContext) {

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
		this.registerSqlServicesModelView();
		this.registerSplitPanelModelView();

		sqlops.tasks.registerTask('sqlservices.clickTask', (profile) => {
			vscode.window.showInformationMessage(`Clicked from profile ${profile.serverName}.${profile.databaseName}`);
		});

		return Promise.resolve(true);
	}

	private registerSqlServicesModelView(): void {
		sqlops.dashboard.registerModelViewProvider('sqlservices', async (view) => {
			let flexModel = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'row',
					alignItems: 'center'
				}).withItems([
					// 1st child panel with N cards
					view.modelBuilder.flexContainer()
						.withLayout({
							flexFlow: 'column',
							alignItems: 'center',
							justifyContent: 'center'
						})
						.withItems([
							view.modelBuilder.card()
								.withProperties<sqlops.CardProperties>({
									label: 'label1',
									value: 'value1',
									actions: [{ label: 'action', taskId: 'sqlservices.clickTask' }]
								})
								.component()
						]).component(),
					// 2nd child panel with N cards
					view.modelBuilder.flexContainer()
						.withLayout({ flexFlow: 'column' })
						.withItems([
							view.modelBuilder.card()
								.withProperties<sqlops.CardProperties>({
									label: 'label2',
									value: 'value2',
									actions: [{ label: 'action', taskId: 'sqlservices.clickTask' }]
								})
								.component()
						]).component()
				], { flex: '1 1 50%' })
				.component();
			await view.initializeModel(flexModel);
		});
	}

	private registerSplitPanelModelView(): void {
		sqlops.dashboard.registerModelViewProvider('splitPanel', async (view) => {
			let numPanels = 3;
			let splitPanel = new SplitPropertiesPanel(view, numPanels);
			await view.initializeModel(splitPanel.modelBase);

			// Add a bunch of cards after an initial timeout
			setTimeout(async () => {

				for (let i = 0; i < 10; i++) {
					let panel = i % numPanels;
					let card = view.modelBuilder.card().component();
					card.label = `label${i.toString()}`;

					splitPanel.addItem(card, panel);
				}

			}, 0);

		});
	}
}

