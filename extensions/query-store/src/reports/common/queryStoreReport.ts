/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';

export abstract class QueryStoreReport {
	protected editor: azdata.workspace.ModelViewEditor;
	protected flexModel?: azdata.FlexContainer;
	protected topFlexModel?: azdata.FlexContainer;
	protected verticalSplitView?: azdata.SplitViewContainer;
	protected horizontalSplitView?: azdata.SplitViewContainer;
	protected toolbar?: azdata.ToolbarBuilder;
	protected configureButton?: azdata.ButtonComponent;

	constructor(reportName: string, private reportTitle: string, private extensionContext: vscode.ExtensionContext) {
		this.editor = azdata.workspace.createModelViewEditor(reportName, { retainContextWhenHidden: true, supportsSave: false }, reportName);
	}

	public async open(): Promise<void> {
		this.editor.registerContent(async (view) => {
			this.flexModel = <azdata.FlexContainer>view.modelBuilder.flexContainer().component();

			const toolbar = (await this.createToolbar(view)).component();
			await toolbar.updateCssStyles({ 'padding': '0px' });
			this.flexModel.addItem(toolbar, { flex: 'none' });

			this.verticalSplitView = <azdata.SplitViewContainer>view.modelBuilder.splitViewContainer().component();

			this.verticalSplitView.addItem(await this.createTopSection(view));
			this.verticalSplitView.addItem(await this.createBottomSection(view));

			this.verticalSplitView.setLayout({
				orientation: 'vertical',
				splitViewHeight: 800
			});

			this.flexModel.addItem(this.verticalSplitView);

			this.flexModel.setLayout({
				flexFlow: 'column',
				height: '100%'
			});

			await view.initializeModel(this.flexModel);
		});

		await this.editor.openEditor();
	}

	protected async createToolbar(view: azdata.ModelView): Promise<azdata.ToolbarBuilder> {
		const toolBar = <azdata.ToolbarBuilder>view.modelBuilder.toolbarContainer();

		this.configureButton = view.modelBuilder.button().withProps({
			label: 'Configure',
			title: 'Configure',
			iconPath: {
				light: path.join(this.extensionContext.extensionPath, 'images', 'light', 'gear.svg'),
				dark: path.join(this.extensionContext.extensionPath, 'images', 'dark', 'gear.svg')
			}
		}).component();

		// TODO: enable after the configuration dialog is implemented
		this.configureButton.enabled = false;

		this.configureButton.onDidClick(() => {
			// TODO: implement configuration dialog
			console.error('configuration dialog not implemented')
		});

		await this.configureButton.updateCssStyles({ 'margin-top': '15px' });

		const reportTitle = view.modelBuilder.text().withProps({
			value: this.reportTitle,
			title: this.reportTitle
		}).component();

		// TODO: get time from configuration
		const timePeriod = view.modelBuilder.text().withProps({
			value: 'Time period: 5/15/2023 11:58 AM - 5/23/2023 11:58 AM',
			title: 'Time period: 5/15/2023 11:58 AM - 5/23/2023 11:58 AM'
		}).component();


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
				component: this.configureButton
			}
		]);

		return toolBar;
	}

	protected createTopSection(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		throw new Error('inheriting class should implement this');
	}

	protected createBottomSection(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		throw new Error('inheriting class should implement this');
	}
}

