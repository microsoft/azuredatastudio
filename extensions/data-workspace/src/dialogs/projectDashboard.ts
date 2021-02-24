/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { IProjectAction, IProjectActionGroup, IProjectProvider, WorkspaceTreeItem } from 'dataworkspace';
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

		await this.createDashboard(project.projectFileName);
		await this.dashboard!.open();
	}

	private async createDashboard(title: string): Promise<void> {
		this.dashboard = azdata.window.createModelViewDashboard(title, 'ProjectDashboard', { alwaysShowTabs: false });
		this.dashboard.registerTabs(async (modelView: azdata.ModelView) => {
			this.modelView = modelView;

			this.overviewTab = {
				title: '',
				id: 'overview-tab',
				content: this.modelView!.modelBuilder.flexContainer().withLayout(
					{
						flexFlow: 'column',
						width: '100%',
						height: '100%'
					}).component(),
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
}
