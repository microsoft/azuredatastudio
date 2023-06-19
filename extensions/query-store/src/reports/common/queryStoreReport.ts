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

			this.verticalSplitView.addItem(await this.createTopFlexContainer(view));
			this.verticalSplitView.addItem(await this.createBottomFlexContainer(view));

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

		const label = view.modelBuilder.text().withProps({
			value: this.reportTitle,
			title: this.reportTitle
		}).component();

		const timePeriodLabel = view.modelBuilder.text().withProps({
			value: 'Time period: 5/15/2023 11:58 AM - 5/23/2023 11:58 AM',
			title: 'Time period: 5/15/2023 11:58 AM - 5/23/2023 11:58 AM'
		}).component();

		toolBar.addToolbarItems([
			{
				component: label,
				toolbarSeparatorAfter: true
			},
			{
				component: timePeriodLabel,
				toolbarSeparatorAfter: true
			},
			{
				component: this.configureButton
			}
		]);

		return toolBar;
	}

	protected async createTopFlexContainer(view: azdata.ModelView): Promise<azdata.Component> {
		const topFlexContainer = view.modelBuilder.flexContainer().component();

		const leftText = view.modelBuilder.text().withProps({
			value: 'left'
		}).component();

		const leftContainer = view.modelBuilder.flexContainer().component();
		leftContainer.addItem(leftText);
		leftContainer.setLayout({
			width: '100%',
			height: '100%'
		});
		await leftContainer.updateCssStyles({ 'background-color': 'chartreuse' });

		const rightText = view.modelBuilder.text().withProps({
			value: 'right'
		}).component();

		const rightContainer = view.modelBuilder.flexContainer().component();
		rightContainer.addItem(rightText);
		rightContainer.setLayout({
			width: '100%',
			height: '100%'
		});
		await rightContainer.updateCssStyles({ 'background-color': 'coral' });

		// TODO: figure out why the horizontal spliview isn't working
		// const horizontalSplitView = <azdata.SplitViewContainer>view.modelBuilder.splitViewContainer().withLayout({
		// 	orientation: 'horizontal',
		// 	splitViewHeight: 200
		// }).component();
		// horizontalSplitView.addItem(leftContainer);
		// horizontalSplitView.addItem(rightContainer);
		// topFlexContainer.addItem(horizontalSplitView);

		topFlexContainer.addItems([leftContainer, rightContainer]);

		topFlexContainer.setLayout({
			flexFlow: 'row',
			width: '100%',
			height: '100%'
		});

		return topFlexContainer;
	}

	protected async createBottomFlexContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const bottomFlexBuilder = view.modelBuilder.flexContainer().component();

		await bottomFlexBuilder.updateCssStyles({ 'background-color': 'darkturquoise' });

		let bottomText = view.modelBuilder.text().withProps({
			value: 'bottom'
		}).component();

		bottomFlexBuilder.addItem(bottomText);

		bottomFlexBuilder.setLayout({
			flexFlow: 'row',
			width: '100%',
			height: '50%'
		});

		return bottomFlexBuilder;
	}
}

