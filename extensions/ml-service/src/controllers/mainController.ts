/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { TreeViewProvider } from '../dataspaceTree/treeView';
import { TreeModel } from '../dataspaceTree/treeModel';
import * as mssql from '../../../mssql';
import { Dataspace } from '../models/dataspace';
import { registerMlTasksWidget } from '../widgets/mlTasksWidget';
import { registerMlEndpointsWidget } from '../widgets/mlEndpointsWidget';
import { registerMlBooksWidget } from '../widgets/mlBooksWidget';
import { registerMlBooksTreeWidget } from '../widgets/mlBooksTreeWidget';

const DATASPACE_VIEWID = 'dataspaceTreeView';
/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {
	protected _context: vscode.ExtensionContext;
	private mssqlOeBrowser: mssql.MssqlObjectExplorerBrowser;


	public constructor(context: vscode.ExtensionContext) {
		this._context = context;
	}

	public get extensionContext(): vscode.ExtensionContext {
		return this._context;
	}

	public deactivate(): void {
	}

	public activate(): Promise<boolean> {
		this.initialize();
		return Promise.resolve(true);
	}

	private initialize(): void {
		this.mssqlOeBrowser = (vscode.extensions.getExtension(mssql.extension.name).exports as mssql.IExtension).getMssqlObjectExplorerBrowser();

		let dataspace = new Dataspace();
		let model = new TreeModel(this.mssqlOeBrowser, this._context);

		const treeViewProvider = new TreeViewProvider(DATASPACE_VIEWID);
		treeViewProvider.Initialize(model);

		this._context.subscriptions.push(vscode.window.registerTreeDataProvider(DATASPACE_VIEWID, treeViewProvider));
		vscode.commands.registerCommand('mlservice.command.refreshDataSets', () => {
			model.createModel(dataspace).then(() => {
				treeViewProvider.Initialize(model);
			});
		});

		azdata.connection.registerConnectionEventListener({
			onConnectionEvent(type: azdata.connection.ConnectionEventType, ownerUri: string, profile: azdata.IConnectionProfile) {
				model.createModel(dataspace).then(() => {
					treeViewProvider.Initialize(model);
				});
			}
		});

		registerMlTasksWidget(dataspace);
		registerMlEndpointsWidget(this._context, dataspace);
		registerMlBooksTreeWidget(this._context);
	}

	public dispose(): void {
		this.deactivate();
	}
}
