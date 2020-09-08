/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { AssessmentDialogComponent } from './assessmentResultComponent';

export class SqlDatabaseTree extends AssessmentDialogComponent {
	async createComponent(view: azdata.ModelView): Promise<azdata.Component> {

		return view.modelBuilder.divContainer().withItems([
			this.createTreeComponent(view)
		]
		).component();
	}

	private createTreeComponent(view: azdata.ModelView): azdata.TreeComponent<any> {
		const tree = view.modelBuilder.tree<azdata.TreeComponentItem>().component();

		tree.registerDataProvider<any>(new SqlDatabaseTreeDataProvider());

		return tree;
	}
}

class SqlDatabaseTreeDataProvider implements azdata.TreeComponentDataProvider<string> {
	getTreeItem(element: string): azdata.TreeComponentItem | Thenable<azdata.TreeComponentItem> {
		throw new Error('Method not implemented.');
	}
	onDidChangeTreeData?: vscode.Event<string> | undefined;
	getChildren(element?: string): vscode.ProviderResult<string[]> {
		return [
			'DB1',
			'DB2',
			'DB3',
			'DB4'
		];
	}
}
