/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IProjectService, ProjectTreeItem as WorkspaceTreeItem } from './interfaces';
import * as nls from 'vscode-nls';
import { EOL } from 'os';
const localize = nls.loadMessageBundle();

/**
 * Tree data provider for the workspace main view
 */
export class WorkspaceTreeDataProvider implements vscode.TreeDataProvider<WorkspaceTreeItem>{
	constructor(private _projectService: IProjectService) { }

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
			const projects = await this._projectService.getProjectsInWorkspace();
			const unknownProjects: string[] = [];
			const treeItems: WorkspaceTreeItem[] = [];
			for (let index = 0; index < projects.length; index++) {
				const project = projects[index];
				const projectProvider = await this._projectService.getProjectProvider(project);
				if (projectProvider === undefined) {
					unknownProjects.push(project);
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
			if (unknownProjects.length > 0) {
				vscode.window.showErrorMessage(localize('UnknownProjectsError', "The following projects are not supported: {0}", unknownProjects.join(EOL)));
			}
			return treeItems;
		}
	}
}
