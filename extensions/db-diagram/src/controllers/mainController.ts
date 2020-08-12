/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import ControllerBase from './controllerBase';
import * as vscode from 'vscode';
import * as azdata from 'azdata';

/**
 * The main controller class that initializes the extension
 */
export default class MainController extends ControllerBase {

	public constructor(
		context: vscode.ExtensionContext,
	) {
		super(context);
	}

	public deactivate(): void {
	}

	public async activate(): Promise<boolean> {
		// ...

		return new Promise<boolean>(async (resolve) => {
			vscode.commands.registerCommand('db-diagram.new', async () => {
				//initialize data model
				//set curr table to first table in dbModel
				//onClick -> currTable becomes refreshes
				//onKeyPressedEnter -> currTables refreshes
				//onGranularityChange -> hide Table View, Show DB View
				//onVisualTabView



				let visualTabLayout: azdata.FlexLayout = {
					flexFlow: 'column'
				};

				const dashboard = azdata.window.createModelViewDashboard('db-diagram');
				dashboard.registerTabs(async (view: azdata.ModelView) => {

					const visualContainer = view.modelBuilder.flexContainer().withItems([]).withLayout(visualTabLayout).component();
					const visualTab = {
						title: 'Visual',
						content: visualContainer,
						id: 'visualTab'
					};

					let contextualTabLayout: azdata.FlexLayout = {
						flexFlow: 'column'
					};

					let searchInput = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
						value: 'Search'
					}).component();

					let granularityDropDown = view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
						value: 'Granularity Selector',
						values: ['Database', 'Table'],
						editable: false,
						fireOnTextChange: false,
						required: false,
					}).component();

					const contextualForm = view.modelBuilder
						.flexContainer()
						.withItems([searchInput, granularityDropDown])
						.withLayout({ flexFlow: 'row', width: 400, justifyContent: 'space-between' })
						.component();


					let summaryTitle = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
						value: 'Summary'
					}).component();

					let summaryDescription = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
						value: 'This is a summary of a table. ' +
							'It is related to 5 other tables, has 4 foreign keys and 1 primary key'
					}).component();

					const contextualSummary = view.modelBuilder
						.flexContainer()
						.withItems([summaryTitle, summaryDescription])
						.withLayout({ flexFlow: 'column' }).component();

					let columnsTitle = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
						value: 'Columns'
					}).component();

					let columnsTable = view.modelBuilder.table().component();

					const contextualColumns = view.modelBuilder
						.flexContainer()
						.withItems([columnsTitle, columnsTable])
						.withLayout({ flexFlow: 'column', width: 400 }).component();

					let relationshipsTitle = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
						value: 'Relationships'
					}).component();

					let relationshipsTable = view.modelBuilder.table().component();

					const contextualRelationships = view.modelBuilder
						.flexContainer()
						.withItems([relationshipsTitle, relationshipsTable])
						.withLayout({ flexFlow: 'column', width: 400 }).component();

					const contextualTables = view.modelBuilder
						.flexContainer()
						.withItems([contextualColumns, contextualRelationships])
						.withLayout({ flexFlow: 'row', width: 800 }).component();

					//const contextualInfo = view.modelBuilder.flexContainer().withItems([]).withLayout({ flexFlow: 'column' }).component();
					const contextualContainer = view.modelBuilder.flexContainer()
						.withItems([contextualForm, contextualSummary, contextualTables])
						.withLayout(contextualTabLayout).component();

					const contextualTab = {
						title: 'Contextual',
						content: contextualContainer,
						id: 'contextualTab'
					};

					const tabbedPanel = view.modelBuilder.tabbedPanel().withTabs(
						[visualTab, contextualTab]
					).component();

					const mainPanel: azdata.DashboardTab = {
						id: 'newDiagram',
						content: tabbedPanel,
						title: 'New Diagram'
					};

					return [mainPanel];

				});
				await dashboard.open();
			});

			resolve(true);
		});


	}

}
