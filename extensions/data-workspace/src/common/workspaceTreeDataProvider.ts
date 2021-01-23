/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { IWorkspaceService } from './interfaces';
import { UnknownProjectsError } from './constants';
import { WorkspaceTreeItem } from 'dataworkspace';
import { TelemetryReporter } from './telemetry';

/**
 * Tree data provider for the workspace main view
 */
export class WorkspaceTreeDataProvider implements vscode.TreeDataProvider<WorkspaceTreeItem>{
	constructor(private _workspaceService: IWorkspaceService) {
		this._workspaceService.onDidWorkspaceProjectsChange(() => {
			this.refresh();
		});
	}

	private _onDidChangeTreeData: vscode.EventEmitter<void | WorkspaceTreeItem | null | undefined> | undefined = new vscode.EventEmitter<WorkspaceTreeItem | undefined | void>();
	readonly onDidChangeTreeData?: vscode.Event<void | WorkspaceTreeItem | null | undefined> | undefined = this._onDidChangeTreeData?.event;

	refresh(): void {
		this._onDidChangeTreeData?.fire();
	}

	getTreeItem(element: WorkspaceTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element.treeDataProvider.getTreeItem(element.element);
	}

	async getChildren(element?: WorkspaceTreeItem | undefined): Promise<WorkspaceTreeItem[]> {
		if (element) {
			const items = await element.treeDataProvider.getChildren(element.element);
			return items ? items.map(item => <WorkspaceTreeItem>{ treeDataProvider: element.treeDataProvider, element: item }) : [];
		}
		else {
			// if the element is undefined return the project tree items
			const projects = await this._workspaceService.getProjectsInWorkspace();
			await vscode.commands.executeCommand('setContext', 'isProjectsViewEmpty', projects.length === 0);
			const unknownProjects: string[] = [];
			const treeItems: WorkspaceTreeItem[] = [];

			const typeMetric: Record<string, number> = {};

			for (const project of projects) {
				const projectProvider = await this._workspaceService.getProjectProvider(project);

				this.incrementProjectTypeMetric(typeMetric, project);

				if (projectProvider === undefined) {
					unknownProjects.push(project.path);
					continue;
				}
				const treeDataProvider = await projectProvider.getProjectTreeDataProvider(project);
				if (treeDataProvider.onDidChangeTreeData) {
					treeDataProvider.onDidChangeTreeData((e: any) => {
						this._onDidChangeTreeData?.fire(e);
					});
				}
				const children = await treeDataProvider.getChildren(element);
				children?.forEach(child => {
					treeItems.push({
						treeDataProvider: treeDataProvider,
						element: child
					});
				});
			}

			TelemetryReporter.sendMetricsEvent(typeMetric, 'OpenWorkspaceProjectTypes');
			TelemetryReporter.sendMetricsEvent(
				{
					'handled': projects.length - unknownProjects.length,
					'unhandled': unknownProjects.length
				},
				'OpenWorkspaceProjectsHandled');

			if (unknownProjects.length > 0) {
				vscode.window.showErrorMessage(UnknownProjectsError(unknownProjects));
			}

			return treeItems;
		}
	}

	private incrementProjectTypeMetric(typeMetric: Record<string, number>, projectUri: vscode.Uri) {
		const ext = path.extname(projectUri.fsPath);

		if (!typeMetric.hasOwnProperty(ext)) {
			typeMetric[ext] = 0;
		}

		typeMetric[ext]++;
	}
}
