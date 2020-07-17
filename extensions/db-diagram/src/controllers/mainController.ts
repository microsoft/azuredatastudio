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

				// //Configure data models
				// let tableSummary = 'This is a summary of a table';

				let visualTabLayout: azdata.FlexLayout = {
					flexFlow: 'column'
				};

				const dashboard = azdata.window.createModelViewDashboard('DB Diagram');
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

					const searchInput = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({ value: 'search' }).component();

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
						.withLayout({ flexFlow: 'row' }).component();

					const contextualInfo = view.modelBuilder.flexContainer().withItems([]).withLayout({ flexFlow: 'column' }).component();
					const contextualContainer = view.modelBuilder.flexContainer().withItems([contextualForm, contextualInfo]).withLayout(contextualTabLayout).component();
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

					// let searchBar = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
					// 	validationErrorMessage: 'validation error message',
					// 	readOnly: false,
					// }).component();

					// let granularitySelector = view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
					// 	value: 'Granularity Selector',
					// 	values: ['Database', 'Table'],
					// 	editable: false,
					// 	fireOnTextChange: false,
					// 	required: false,
					// }).component();

					// let summaryTitle = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					// 	value: 'Summary'
					// }).component();

					// let summaryDescription = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					// 	value: tableSummary
					// }).component();

					// let summaryCard = view.modelBuilder.flexContainer()
					// 	.withLayout({
					// 		flexFlow: 'column',
					// 		alignItems: 'center'
					// 	})
					// 	.withItems([
					// 		summaryTitle, summaryDescription
					// 	])
					// 	.component();


					// let relationshipsTitle = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					// 	value: 'Relationships'
					// }).component();

					// let relationshipsTable = view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
					// 	data: null, //need to consult how to populate these datatables
					// 	columns: null,
					// 	fontSize: null,
					// 	selectedRows: null,
					// 	forceFitColumns: null,
					// 	title: null,
					// 	ariaRowCount: null,
					// 	ariaColumnCount: null,
					// 	updateCells: null,
					// 	moveFocusOutWithTab: null
					// }).component();

					// let relationshipsCard = view.modelBuilder.flexContainer()
					// 	.withLayout({
					// 		flexFlow: 'column',
					// 		alignItems: 'center'
					// 	})
					// 	.withItems([
					// 		relationshipsTitle, relationshipsTable
					// 	])
					// 	.component();

					// let columnsTitle = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					// 	value: 'Columns'
					// }).component();

					// let columnsTable = view.modelBuilder.table().component();

					// let columnsCard = view.modelBuilder.flexContainer()
					// 	.withLayout({
					// 		flexFlow: 'column',
					// 		alignItems: 'center',
					// 	})
					// 	.withItems([
					// 		columnsTitle, columnsTable
					// 	])
					// 	.component();

					// let mainModel = view.modelBuilder.flexContainer()
					// 	.withLayout({
					// 		flexFlow: 'row',
					// 		alignItems: 'center'
					// 	})
					// 	.withItems([
					// 		searchBar, granularitySelector, summaryCard, columnsCard, relationshipsCard
					// 	])
					// 	.component();

					// const homeTab: azdata.DashboardTab = {
					// 	id: 'home',
					// 	content: mainModel,
					// 	title: 'Home',
					// };

				});
				await dashboard.open();
			});

			resolve(true);
		});


	}

}
