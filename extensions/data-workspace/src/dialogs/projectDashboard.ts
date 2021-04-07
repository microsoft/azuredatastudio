/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IDashboardColumnInfo, IDashboardTable, IProjectAction, IProjectActionGroup, IProjectProvider, WorkspaceTreeItem } from 'dataworkspace';
import * as path from 'path';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { IconPathHelper } from '../common/iconHelper';
import { IWorkspaceService } from '../common/interfaces';
import { fileExist } from '../common/utils';

export class ProjectDashboard {

	private dashboard: azdata.window.ModelViewDashboard | undefined;
	private modelView: azdata.ModelView | undefined;
	private projectProvider: IProjectProvider | undefined;
	private overviewTab: azdata.DashboardTab | undefined;
	private rootContainer: azdata.FlexContainer | undefined;
	private tableContainer: azdata.Component | undefined;

	constructor(private _workspaceService: IWorkspaceService, private _treeItem: WorkspaceTreeItem) {
	}

	public async showDashboard(): Promise<void> {
		const project = this._treeItem.element.project;

		if (!(await fileExist(project.projectFilePath))) {
			throw new Error(constants.fileDoesNotExist(project.projectFilePath));
		}

		if (!project.projectFileName) {
			throw new Error(constants.projectNameNull);
		}

		this.projectProvider = await this._workspaceService.getProjectProvider(vscode.Uri.file(project.projectFilePath));
		if (!this.projectProvider) {
			throw new Error(constants.ProviderNotFoundForProjectTypeError(project.projectFilePath));
		}

		await this.createDashboard(project.projectFileName, project.projectFilePath);
		await this.dashboard!.open();
	}

	private async createDashboard(title: string, location: string): Promise<void> {
		this.dashboard = azdata.window.createModelViewDashboard(title, 'ProjectDashboard', { alwaysShowTabs: false });
		this.dashboard.registerTabs(async (modelView: azdata.ModelView) => {
			this.modelView = modelView;

			this.overviewTab = {
				title: '',
				id: 'overview-tab',
				content: this.createContainer(title, location),
				toolbar: this.createToolbarContainer()
			};
			return [
				this.overviewTab
			];
		});
	}

	private createToolbarContainer(): azdata.ToolbarContainer {
		const projectActions: (IProjectAction | IProjectActionGroup)[] = this.projectProvider!.projectActions;

		// Add actions as buttons
		const buttons: azdata.ToolbarComponent[] = [];

		const projectActionsLength = projectActions.length;

		projectActions.forEach((action, actionIndex) => {
			if (this.isProjectAction(action)) {
				const button = this.createButton(action);
				buttons.push({ component: button, toolbarSeparatorAfter: (projectActionsLength - 1 === actionIndex) });
			} else {
				const groupLength = action.actions.length;

				action.actions.forEach((groupAction, index) => {
					const button = this.createButton(groupAction);
					buttons.push({ component: button, toolbarSeparatorAfter: ((groupLength - 1 === index) || (projectActionsLength - 1 === actionIndex)) });	// Add toolbar separator at the end of the group
				});
			}
		});

		const refreshButton = this.modelView!.modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: constants.Refresh,
				iconPath: IconPathHelper.refresh,
				height: '20px'
			}).component();

		refreshButton.onDidClick(() => {
			this.rootContainer?.removeItem(this.tableContainer!);
			this.tableContainer = this.createTables();
			this.rootContainer?.addItem(this.tableContainer);
		});

		buttons.push({ component: refreshButton });

		return this.modelView!.modelBuilder.toolbarContainer()
			.withToolbarItems(
				buttons
			).component();
	}

	private isProjectAction(obj: any): obj is IProjectAction {
		return obj.id !== undefined;
	}

	private createButton(projectAction: IProjectAction): azdata.ButtonComponent {
		let button = this.modelView!.modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: projectAction.id,
				iconPath: projectAction.icon,
				height: '20px'
			}).component();

		button.onDidClick(async () => {
			await projectAction.run(this._treeItem);
		});

		return button;
	}

	private createContainer(title: string, location: string): azdata.FlexContainer {
		this.rootContainer = this.modelView!.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'column',
				width: '100%',
				height: '100%'
			}).component();

		const headerContainer = this.createHeader(title, location);
		this.tableContainer = this.createTables();

		this.rootContainer.addItem(headerContainer);
		this.rootContainer.addItem(this.tableContainer);

		return this.rootContainer;
	}

	/**
	 * Create header with title, location and background
	 */
	private createHeader(title: string, location: string): azdata.Component {
		const headerContainer = this.modelView!.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'column',
				width: '100%',
				height: '30%'
			}).component();

		const header = this.modelView!.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'column',
				width: '100%',
				height: '30%'
			}).component();

		const titleLabel = this.modelView!.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: title, CSSStyles: { 'margin-block-start': '20px', 'margin-block-end': '0px' } })
			.component();
		header.addItem(titleLabel, { CSSStyles: { 'padding-left': '34px', 'padding-top': '15px', 'font-size': '36px', 'font-weight': '400' } });

		const projectFolderPath = path.dirname(location);
		const locationLabel = this.modelView!.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: projectFolderPath, CSSStyles: { 'margin-block-start': '20px', 'margin-block-end': '0px' } })
			.component();
		header.addItem(locationLabel, { CSSStyles: { 'padding-left': '34px', 'padding-top': '15px', 'padding-bottom': '50px', 'font-size': '16px' } });

		const image = this.projectProvider!.image;		// background image added at the bottom right of the header
		headerContainer.addItem(header, {
			CSSStyles: {
				'background-image': `url(${vscode.Uri.file(image!.light.toString())})`,
				'background-repeat': 'no-repeat',
				'background-position': '85% bottom',
				'background-size': '10%',
				'border-bottom': 'solid 1px #ccc',
				'width': '100%',
				'height': '100%'
			}
		});

		return headerContainer;
	}

	/**
	 * Adds all the tables to the container
	 */
	private createTables(): azdata.Component {
		const dashboardData: IDashboardTable[] = this.projectProvider!.dashboardComponents;

		const tableContainer = this.modelView!.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'column',
				width: '100%',
				height: 'auto'
			}).component();

		dashboardData.forEach(info => {
			const tableNameLabel = this.modelView!.modelBuilder.text()
				.withProperties<azdata.TextComponentProperties>({ value: info.name, CSSStyles: { 'margin-block-start': '30px', 'margin-block-end': '0px' } })
				.component();
			tableContainer.addItem(tableNameLabel, { CSSStyles: { 'padding-left': '25px', 'padding-bottom': '20px', ...constants.cssStyles.title } });

			if (info.data.length === 0) {
				const noDataText = constants.noPreviousData(info.name.toLocaleLowerCase());
				const noDataLabel = this.modelView!.modelBuilder.text()
					.withProperties<azdata.TextComponentProperties>({ value: noDataText })//, CSSStyles: { 'margin-block-start': '30px', 'margin-block-end': '0px' } })
					.component();
				tableContainer.addItem(noDataLabel, { CSSStyles: { 'padding-left': '25px', 'padding-bottom': '20px' } });
			} else {
				const columns: azdata.DeclarativeTableColumn[] = [];
				info.columns.forEach((column: IDashboardColumnInfo) => {
					let col = {
						displayName: column.displayName,
						valueType: column.type === 'icon' ? azdata.DeclarativeDataType.component : azdata.DeclarativeDataType.string,
						isReadOnly: true,
						width: column.width,
						headerCssStyles: {
							'border': 'none',
							...constants.cssStyles.tableHeader
						},
						rowCssStyles: {
							...constants.cssStyles.tableRow
						},
					};
					columns.push(col);
				});

				const data: azdata.DeclarativeTableCellValue[][] = [];
				info.data.forEach(values => {
					const columnValue: azdata.DeclarativeTableCellValue[] = [];
					values.forEach(val => {
						if (typeof val === 'string') {
							columnValue.push({ value: val });
						} else {
							const iconComponent = this.modelView!.modelBuilder.image().withProperties<azdata.ImageComponentProperties>({
								iconPath: val.icon,
								width: '15px',
								height: '15px',
								iconHeight: '15px',
								iconWidth: '15px'
							}).component();
							const stringComponent = this.modelView!.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
								value: val.text,
								CSSStyles: { 'margin-block-start': 'auto', 'block-size': 'auto', 'margin-block-end': '0px' }
							}).component();

							const columnData = this.modelView!.modelBuilder.flexContainer().withItems([iconComponent, stringComponent], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row' }).component();
							columnValue.push({ value: columnData });
						}
					});
					data.push(columnValue);
				});

				const table = this.modelView!.modelBuilder.declarativeTable()
					.withProperties<azdata.DeclarativeTableProperties>({ columns: columns, dataValues: data, ariaLabel: info.name, CSSStyles: { 'margin-left': '30px' } }).component();

				tableContainer.addItem(table);
			}
		});
		return tableContainer;
	}
}
