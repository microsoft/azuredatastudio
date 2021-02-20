/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { IProjectAction, IProjectActionGroup, IProjectProvider, WorkspaceTreeItem } from 'dataworkspace';
import { IWorkspaceService } from '../common/interfaces';

export class ProjectDashboard {

	private dashboard: azdata.window.ModelViewDashboard | undefined;
	private modelView: azdata.ModelView | undefined;
	private projectProvider: IProjectProvider | undefined;
	private overviewTab: azdata.DashboardTab | undefined;

	constructor(private workspaceService: IWorkspaceService, private treeItem: WorkspaceTreeItem) {
	}

	public async showDashboard(): Promise<void> {
		const project = this.treeItem.element.project;
		this.projectProvider = await this.workspaceService.getProjectProvider(vscode.Uri.file(project.projectFilePath));
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
				content: this.createContainer(title),
				toolbar: await this.createToolbarContainer()
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

		projectActions.forEach(action => {
			if (this.isProjectAction(action)) {
				let button = this.createButton(action);

				buttons.push({ component: button });
			} else {
				const groupLength = action.actions.length;
				let lastAction = 0;
				let toolbarSeparatorAfter = false;

				action.actions.forEach(groupAction => {
					let button = this.createButton(groupAction);

					lastAction++;
					if (groupLength === lastAction) {
						toolbarSeparatorAfter = true;
					}

					buttons.push({ component: button, toolbarSeparatorAfter: toolbarSeparatorAfter });
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
			await projectAction.run(this.treeItem);
		});

		return button;
	}

	private createContainer(projectName: string): azdata.FlexContainer {
		const rootContainer = this.modelView!.modelBuilder.flexContainer().withLayout(
			{
				flexFlow: 'column',
				width: '100%',
				height: '100%'
			}).component();

		return rootContainer;
	}


}
