/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as nbExtensionApis from '../typings/notebookServices';
import { isNullOrUndefined } from 'util';
import { PackageManager } from '../packageManagement/packageManager';
import * as constants from '../common/constants';
import { ApiWrapper } from '../common/apiWrapper';
import { QueryRunner } from '../common/queryRunner';

const NotebookExtensionName = 'Microsoft.notebook';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {
	protected _context: vscode.ExtensionContext;
	private _nbExtensionApis: nbExtensionApis.IExtensionApi;
	private _packageManager: PackageManager;
	private _outputChannel: vscode.OutputChannel;
	private _rootPath: string;
	private _apiWrapper: ApiWrapper;
	private _queryRunner: QueryRunner;

	public constructor(context: vscode.ExtensionContext) {
		this._context = context;
		this._outputChannel = vscode.window.createOutputChannel(constants.extensionOutputChannel);
	}

	public deactivate(): void {
	}

	public activate(): Promise<boolean> {
		this.initialize();
		return Promise.resolve(true);
	}

	/**
	 * Returns an instance of Jupyter Server Installation from notebook extension
	 */
	private getNotebookExtensionApis(): nbExtensionApis.IExtensionApi {
		if (isNullOrUndefined(this._nbExtensionApis)) {
			// TODO: wait for extension to load
			this._nbExtensionApis = (vscode.extensions.getExtension(NotebookExtensionName).exports as nbExtensionApis.IExtensionApi);
		}
		return this._nbExtensionApis;
	}

	private async initialize(): Promise<void> {
		this._outputChannel.show(true);
		this._rootPath = this._context.extensionPath;
		this._apiWrapper = new ApiWrapper();
		this._queryRunner = new QueryRunner(this._apiWrapper);
		this._packageManager = new PackageManager(this.getNotebookExtensionApis(), this._outputChannel, this._rootPath, this._apiWrapper, this._queryRunner);
		vscode.commands.registerCommand(constants.mlManagePackagesCommand, (() => {
			this._packageManager.managePackages();
		}));
		try {
			await this._packageManager.installDependencies();
		} catch (err) {
			this._outputChannel.appendLine(err);
		}
	}

	public dispose(): void {
		this.deactivate();
	}
}
