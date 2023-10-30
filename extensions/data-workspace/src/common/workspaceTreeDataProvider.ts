/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { IWorkspaceService } from './interfaces';
import { dragAndDropNotSupported, onlyMovingOneFileIsSupported, projectFailedToLoad, UnknownProjectsError } from './constants';
import { WorkspaceTreeItem } from 'dataworkspace';
import { TelemetryReporter } from './telemetry';
import { getErrorMessage } from './utils';
import Logger from './logger';

/**
 * Tree data provider for the workspace main view
 */
export class WorkspaceTreeDataProvider implements vscode.TreeDataProvider<WorkspaceTreeItem>, vscode.TreeDragAndDropController<WorkspaceTreeItem> {
	dropMimeTypes = ['application/vnd.code.tree.workspacetreedataprovider'];
	dragMimeTypes = ['application/vnd.code.tree.workspacetreedataprovider'];

	constructor(private _workspaceService: IWorkspaceService) {
		this._workspaceService.onDidWorkspaceProjectsChange(() => {
			return this.refresh();
		});

		vscode.window.createTreeView('dataworkspace.views.main', { canSelectMany: false, treeDataProvider: this, dragAndDropController: this });
	}

	private _onDidChangeTreeData: vscode.EventEmitter<void | WorkspaceTreeItem | null | undefined> | undefined = new vscode.EventEmitter<WorkspaceTreeItem | undefined | void>();
	readonly onDidChangeTreeData?: vscode.Event<void | WorkspaceTreeItem | null | undefined> | undefined = this._onDidChangeTreeData?.event;

	async refresh(): Promise<void> {
		Logger.log(`Refreshing projects tree`);
		await this._workspaceService.getProjectsInWorkspace(undefined, true);
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
			Logger.log(`Calling getProjectsInWorkspace() from getChildren()`);
			const projects = await this._workspaceService.getProjectsInWorkspace(undefined, false);
			await vscode.commands.executeCommand('setContext', 'isProjectsViewEmpty', projects.length === 0);
			const unknownProjects: string[] = [];
			const treeItems: WorkspaceTreeItem[] = [];

			const typeMetric: Record<string, number> = {};

			let errorMessages: { project: vscode.Uri, errorMessage: string }[] = [];
			for (const project of projects) {
				try {
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
				} catch (e) {
					errorMessages.push({ project: project, errorMessage: getErrorMessage(e) });
					console.error(e.message);
				}
			}

			if (errorMessages.length > 0) {
				for (let error of errorMessages) {
					void vscode.window.showErrorMessage(projectFailedToLoad(path.basename(error.project.fsPath), error.errorMessage + (error.errorMessage.endsWith('.') ? '' : '.')));
				}
			}

			TelemetryReporter.sendMetricsEvent(typeMetric, 'OpenWorkspaceProjectTypes');
			TelemetryReporter.sendMetricsEvent(
				{
					'handled': projects.length - unknownProjects.length,
					'unhandled': unknownProjects.length
				},
				'OpenWorkspaceProjectsHandled');

			if (unknownProjects.length > 0) {
				void vscode.window.showErrorMessage(UnknownProjectsError(unknownProjects));
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

	handleDrag(treeItems: readonly WorkspaceTreeItem[], dataTransfer: vscode.DataTransfer): void | Thenable<void> {
		// Don't do anything if trying to drag the project node since it isn't supported. Because canSelectMany is set to false for WorkspaceTreeDataProvider,
		// treeItems will only contain one treeItem, so we only need to check the first one in the list.
		const relativePath = treeItems[0].element?.relativeProjectUri?.fsPath?.substring(1); // remove leading slash
		const projBaseName = path.basename(treeItems[0].element?.projectFileUri?.fsPath, path.extname(treeItems[0].element?.projectFileUri?.fsPath));
		if (relativePath === projBaseName) {
			return;
		}

		dataTransfer.set('application/vnd.code.tree.WorkspaceTreeDataProvider', new vscode.DataTransferItem(treeItems.map(t => t.element)));
	}

	async handleDrop(target: WorkspaceTreeItem | undefined, sources: vscode.DataTransfer): Promise<void> {
		if (!target) {
			return;
		}

		const transferItem = sources.get('application/vnd.code.tree.WorkspaceTreeDataProvider');

		// Only support moving one file at a time
		// canSelectMany is set to false for the WorkspaceTreeDataProvider, so this condition should never be true
		if (transferItem?.value.length > 1) {
			void vscode.window.showErrorMessage(onlyMovingOneFileIsSupported);
			return;
		}

		const projectUri = transferItem?.value[0].projectFileUri;
		if (!projectUri) {
			return;
		}

		const projectProvider = await this._workspaceService.getProjectProvider(projectUri);
		if (!projectProvider) {
			return;
		}

		if (!projectProvider?.supportsDragAndDrop || !projectProvider.moveFile) {
			void vscode.window.showErrorMessage(dragAndDropNotSupported);
			return;
		}

		// Move the file
		await projectProvider!.moveFile(projectUri, transferItem?.value[0], target);
		void this.refresh();
	}
}
