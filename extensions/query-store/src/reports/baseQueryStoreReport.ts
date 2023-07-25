/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';
import * as utils from '../common/utils';
import * as constants from '../common/constants';
import { ConfigureDialog } from '../settings/configureDialog';

export abstract class BaseQueryStoreReport {
	protected editor: azdata.workspace.ModelViewEditor;
	protected flexModel?: azdata.FlexContainer;

	//public configureDialog: ConfigureDialog;

	constructor(reportName: string, private reportTitle: string, protected resizeable: boolean, private extensionContext: vscode.ExtensionContext) {
		this.editor = azdata.workspace.createModelViewEditor(reportName, { retainContextWhenHidden: true, supportsSave: false }, reportName);
	}

	/**
	 * Creates and opens the report
	 */
	public async open(): Promise<void> {
		this.editor.registerContent(async (view) => {
			this.flexModel = <azdata.FlexContainer>view.modelBuilder.flexContainer().component();

			const toolbar = await this.createToolbar(view);
			this.flexModel.addItem(toolbar, { flex: 'none' });

			const views = await this.createViews(view);

			const mainContainer = await this.createMainContainer(view, views);

			this.flexModel.addItem(mainContainer, { CSSStyles: { 'width': '100%', 'height': '100%' } });

			this.flexModel.setLayout({
				flexFlow: 'column',
				height: '100%'
			});

			await view.initializeModel(this.flexModel);
		});

		await this.editor.openEditor();
	}

	/**
	 * Creates the main container containing the different components of the report
	 * @param view
	 * @param containers Array of containers to add to the main container
	 * @returns FlexContainer or SplitViewContainer containing the containers
	 */
	private async createMainContainer(view: azdata.ModelView, containers: azdata.FlexContainer[]): Promise<azdata.FlexContainer | azdata.SplitViewContainer> {
		let mainContainer;

		switch (containers.length) {
			case 1: {
				mainContainer = containers[0];
				break;
			}
			case 2: {
				// one container on top, one on the bottom
				mainContainer = this.resizeable ? utils.createSplitView(view, containers[0], containers[1], 'vertical') : utils.createTwoComponentFlexContainer(view, containers[0], containers[1], 'column');
				break;
			} case 3: {
				// 2 containers on top, one on the bottom
				mainContainer = this.resizeable ? utils.createSplitView(view, utils.createSplitView(view, containers[0], containers[1], 'horizontal'), containers[2], 'vertical')
					: utils.createTwoComponentFlexContainer(view, utils.createTwoComponentFlexContainer(view, containers[0], containers[1], 'row'), containers[2], 'column');
				break;
			} case 4: {
				// 2 containers on top, 2 on the bottom
				mainContainer = this.resizeable ? utils.createSplitView(view, utils.createTwoComponentFlexContainer(view, containers[0], containers[1], 'row'), utils.createTwoComponentFlexContainer(view, containers[2], containers[3], 'row'), 'vertical')
					: utils.createTwoComponentFlexContainer(view, utils.createTwoComponentFlexContainer(view, containers[0], containers[1], 'row'), utils.createTwoComponentFlexContainer(view, containers[2], containers[3], 'row'), 'column');
				break;
			} default: {
				throw new Error(`{views.length} number of views in a QDS report is not supported`);
			}
		}

		return mainContainer
	}

	/**
	 * Creates the toolbar for the overall report with the report title, time range, and configure button
	 * @param view
	 */
	protected async createToolbar(view: azdata.ModelView): Promise<azdata.ToolbarContainer> {
		const toolBar = <azdata.ToolbarBuilder>view.modelBuilder.toolbarContainer().withProps({
			CSSStyles: { 'padding': '5px' }
		});

		const reportTitle = view.modelBuilder.text().withProps({
			value: this.reportTitle,
			title: this.reportTitle,
			CSSStyles: { 'margin-top': '5px', 'margin-bottom': '5px', 'margin-right': '15px' }
		}).component();

		// TODO: get time from configuration dialog
		const timePeriod = view.modelBuilder.text().withProps({
			// placeholder times
			value: 'Time period: 5/15/2023 11:58 AM - 5/23/2023 11:58 AM',
			title: 'Time period: 5/15/2023 11:58 AM - 5/23/2023 11:58 AM',
			CSSStyles: { 'margin-top': '5px', 'margin-bottom': '5px', 'margin-right': '15px' }
		}).component();

		const configureButton = view.modelBuilder.button().withProps({
			label: constants.configure,
			title: constants.configure,
			iconPath: {
				light: path.join(this.extensionContext.extensionPath, 'images', 'light', 'gear.svg'),
				dark: path.join(this.extensionContext.extensionPath, 'images', 'dark', 'gear.svg')
			}
		}).component();
		configureButton.enabled = true;

		configureButton.onDidClick(async () => {
			let configureDialog = new ConfigureDialog();
			await configureDialog.openDialog();
		});

		await configureButton.updateCssStyles({ 'margin-top': '5px' });

		toolBar.addToolbarItems([
			{
				component: reportTitle,
				toolbarSeparatorAfter: true
			},
			{
				component: timePeriod,
				toolbarSeparatorAfter: true
			},
			{
				component: configureButton
			}
		]);

		return toolBar.component();
	}

	protected abstract createViews(_view: azdata.ModelView): Promise<azdata.FlexContainer[]>;
}

