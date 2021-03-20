/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import * as path from 'path';
import { IDashboardColumnData, IDashboardColumnInfo, IProjectAction, IProjectActionGroup, IProjectInfo, IProjectProvider, WorkspaceTreeItem } from 'dataworkspace';
import { IWorkspaceService } from '../common/interfaces';
import { fileExist } from '../common/utils';

export class ProjectDashboard {

	private dashboard: azdata.window.ModelViewDashboard | undefined;
	private modelView: azdata.ModelView | undefined;
	private projectProvider: IProjectProvider | undefined;
	private overviewTab: azdata.DashboardTab | undefined;

	constructor(private _workspaceService: IWorkspaceService, private _treeItem: WorkspaceTreeItem) {
	}

	public async showDashboard(): Promise<void> {
		const project = this._treeItem.element.project;

		if (!(await fileExist(project.projectFilePath)) || project.projectFileName === null) {
			throw new Error(constants.fileDoesNotExist(project.projectFilePath));
		}

		if (project.projectFileName === null) {
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
				let button = this.createButton(action);

				buttons.push({ component: button });
			} else {
				const groupLength = action.actions.length;

				action.actions.forEach((groupAction, index) => {
					let button = this.createButton(groupAction);

					buttons.push({ component: button, toolbarSeparatorAfter: ((groupLength - 1 === index) && (projectActionsLength - 1 !== actionIndex)) });	// Add toolbar separator at the end of the group, if the group is not the last in the list
				});
			}
		});

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

	public createContainer(title: string, location: string): azdata.FlexContainer {
		const projectInfo: IProjectInfo[] = this.projectProvider!.projectInfo;

		const rootContainer = this.modelView!.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'column',
				width: '100%',
				height: '100%'
			}).component();

		const titleLabel = this.modelView!.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: title, CSSStyles: { 'margin-block-start': '20px', 'margin-block-end': '0px' } })
			.component();
		rootContainer.addItem(titleLabel, { CSSStyles: { 'padding-left': '34px', 'padding-top': '15px', 'font-size': '36px', 'font-weight': '400' } });

		const projectFolderPath = vscode.Uri.file(path.dirname(location)).fsPath;
		const locationLabel = this.modelView!.modelBuilder.text()
			.withProperties<azdata.TextComponentProperties>({ value: projectFolderPath, CSSStyles: { 'margin-block-start': '20px', 'margin-block-end': '0px' } })
			.component();
		rootContainer.addItem(locationLabel, { CSSStyles: { 'padding-left': '34px', 'padding-top': '15px', 'padding-bottom': '50px', 'font-size': '16px' } });

		// Add all the tables to the container
		projectInfo.forEach(info => {
			const tableNameLabel = this.modelView!.modelBuilder.text()
				.withProperties<azdata.TextComponentProperties>({ value: info.tableName, CSSStyles: { 'margin-block-start': '30px', 'margin-block-end': '0px' } })
				.component();
			rootContainer.addItem(tableNameLabel, { CSSStyles: { 'padding-left': '25px', 'padding-bottom': '20px', ...constants.cssStyles.title } });

			const columns: azdata.DeclarativeTableColumn[] = [];
			info.columnInfo.forEach((column: IDashboardColumnInfo) => {
				let col = {
					displayName: column.displayName,
					valueType: column.valueType,
					isReadOnly: true,
					width: column.width,
					headerCssStyles: {
						'border': 'none',
						...constants.cssStyles.tableHeader
					},
					rowCssStyles: {
						'border-top': 'solid 1px #ccc',
						'border-bottom': 'solid 1px #ccc',
						'border-left': 'none',
						'border-right': 'none'
					},
				};
				columns.push(col);
			});

			const data: azdata.DeclarativeTableCellValue[][] = [];
			info.columnData.forEach(values => {
				const columnValue: azdata.DeclarativeTableCellValue[] = [];
				values.forEach(val => {

					if (this.isIDashboardColumnData(val)) {
						let v;
						const type = typeof val.value;
						if (type === 'string' || type === 'boolean' || type === 'number') {
							v = val.value;
						} else {
							v = this.createComponent(val);
						}
						columnValue.push({ value: v });
					} else {
						let columnDataGroup = this.modelView!.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
						val.values.forEach((values: IDashboardColumnData) => {
							let v = this.createComponent(values);

							columnDataGroup.addItem(v, { CSSStyles: { 'margin-right': '10px' } });
						});
						columnValue.push({ value: columnDataGroup });
					}
				});
				data.push(columnValue);
			});

			let table = this.modelView!.modelBuilder.declarativeTable()
				.withProperties<azdata.DeclarativeTableProperties>({ columns: columns, dataValues: data, ariaLabel: info.tableName, CSSStyles: { 'margin-left': '30px' } }).component();

			rootContainer.addItem(table);
		});

		return rootContainer;
	}

	private isIDashboardColumnData(obj: any): obj is IDashboardColumnData {
		return obj.value !== undefined;
	}

	private createComponent(columnData: IDashboardColumnData): azdata.Component {
		let component;
		if (typeof columnData.value === 'string') {
			component = this.modelView!.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
				value: columnData.value, CSSStyles: { 'margin-block-start': 'auto', 'block-size': 'auto', 'margin-block-end': '0px' }
			})
				.component();
		} else {	// it is an image
			component = this.modelView!.modelBuilder.image().withProperties<azdata.ImageComponentProperties>({
				iconPath: columnData.value,
				width: '15px',
				height: '15px',
				iconHeight: '15px',
				iconWidth: '15px'
			})
				.component();
		}

		return component;
	}
}
