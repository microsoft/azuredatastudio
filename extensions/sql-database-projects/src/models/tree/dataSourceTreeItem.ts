/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { BaseProjectTreeItem } from './baseTreeItem';
import * as constants from '../../common/constants';
import { ProjectRootTreeItem } from './projectTreeItem';

export class DataSourcesTreeItem extends BaseProjectTreeItem {
	private dataSources: DataSourceTreeItem[] = [];

	constructor(project: ProjectRootTreeItem) {
		super(vscode.Uri.file(path.join(project.uri.path, constants.dataSourcesNodeName)), project);
	}

	public createDataSource(json: string) {
		this.dataSources.push(constructDataSourceTreeItem(json, this));
	}

	public get children(): BaseProjectTreeItem[] {
		return this.dataSources;
	}

	public get treeItem(): vscode.TreeItem {
		return new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.Collapsed);
	}
}

abstract class DataSourceTreeItem extends BaseProjectTreeItem { }

export class SqlConnectionDataSourceTreeItem extends DataSourceTreeItem {
	constructor(json: string, dataSourcesNode: DataSourcesTreeItem) {
		const name = json; // parse placeholder

		super(vscode.Uri.parse(path.join(dataSourcesNode.uri.path, name)), dataSourcesNode);
	}

	public get treeItem(): vscode.TreeItem {
		return new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.None);
	}

	public get children(): BaseProjectTreeItem[] {
		return [];
	}
}

// TODO: should this be constructed by the treeItem or by the dataSource?
export function constructDataSourceTreeItem(json: string, dataSourcesNode: DataSourcesTreeItem): DataSourceTreeItem {
	// eventual switch statement

	return new SqlConnectionDataSourceTreeItem(json, dataSourcesNode);
}
