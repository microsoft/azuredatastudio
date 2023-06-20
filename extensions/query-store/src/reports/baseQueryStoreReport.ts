/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';
import * as utils from '../common/utils';
import * as constants from '../common/constants';

export abstract class BaseQueryStoreReport {
	protected editor: azdata.workspace.ModelViewEditor;
	protected flexModel?: azdata.FlexContainer;

	constructor(reportName: string, private reportTitle: string, protected resizeable: boolean, private extensionContext: vscode.ExtensionContext) {
		this.editor = azdata.workspace.createModelViewEditor(reportName, { retainContextWhenHidden: true, supportsSave: false }, reportName);
	}

	public async open(): Promise<void> {
		this.editor.registerContent(async (view) => {
			this.flexModel = <azdata.FlexContainer>view.modelBuilder.flexContainer().component();

			const toolbar = (await this.createToolbar(view)).component();
			await toolbar.updateCssStyles({ 'padding': '5px' });
			this.flexModel.addItem(toolbar, { flex: 'none' });

			if (this.resizeable) {
				// TODO: replace 800 to have the number be based on how big the window is
				const verticalSplitView = utils.createVerticalSplitView(view, await this.createTopSection(view), await this.createBottomSection(view), 800);
				this.flexModel.addItem(verticalSplitView);
			} else {
				const verticalFlexContainer = await utils.createTwoComponentFlexContainer(view, await this.createTopSection(view), await this.createBottomSection(view), 'column');
				this.flexModel.addItem(verticalFlexContainer, { CSSStyles: { 'width': '100%', 'height': '100%' } });
			}


			this.flexModel.setLayout({
				flexFlow: 'column',
				height: '100%'
			});

			await view.initializeModel(this.flexModel);
		});

		await this.editor.openEditor();
	}

	/**
	 * Creates the toolbar for the overall report with the report title, time range, and configure button
	 * @param view
	 */
	protected async createToolbar(view: azdata.ModelView): Promise<azdata.ToolbarBuilder> {
		const toolBar = <azdata.ToolbarBuilder>view.modelBuilder.toolbarContainer();

		const reportTitle = view.modelBuilder.text().withProps({
			value: this.reportTitle,
			title: this.reportTitle,
			CSSStyles: { 'margin-top': '5px', 'margin-bottom': '5px', 'margin-right': '15px' }
		}).component();

		// TODO: get time from configuration
		const timePeriod = view.modelBuilder.text().withProps({
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

		// TODO: enable after the configuration dialog is implemented
		configureButton.enabled = false;

		configureButton.onDidClick(() => {
			// TODO: implement configuration dialog
			console.error('configuration dialog not implemented')
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

		return toolBar;
	}

	protected abstract createTopSection(_view: azdata.ModelView): Promise<azdata.FlexContainer>;

	protected abstract createBottomSection(_view: azdata.ModelView): Promise<azdata.FlexContainer>;
}

