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
import { ProcessService } from '../common/processService';
import { Config } from '../common/config';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {

	private _nbExtensionApis: nbExtensionApis.IExtensionApi;
	private _outputChannel: vscode.OutputChannel;
	private _rootPath = this._context.extensionPath;
	private _config: Config;
	private _packageManager: PackageManager;

	public constructor(
		private _context: vscode.ExtensionContext,
		private _apiWrapper: ApiWrapper,
		private _queryRunner: QueryRunner,
		private _processService: ProcessService,
	) {
		this._outputChannel = this._apiWrapper.createOutputChannel(constants.extensionOutputChannel);
		this._rootPath = this._context.extensionPath;
		this._config = new Config(this._rootPath);
	}

	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
	}

	/**
	 * Activates the extension
	 */
	public async activate(): Promise<boolean> {
		await this.initialize();
		return Promise.resolve(true);
	}

	/**
	 * Returns an instance of Server Installation from notebook extension
	 */
	private async loadNotebookExtensionApis(): Promise<void> {
		if (isNullOrUndefined(this._nbExtensionApis)) {
			let nbExtension = this._apiWrapper.getExtension(constants.notebookExtensionName);
			await nbExtension.activate();
			this._nbExtensionApis = (nbExtension.exports as nbExtensionApis.IExtensionApi);
		}
		return;
	}

	private async initialize(): Promise<void> {
		this._outputChannel.show(true);
		await this.loadNotebookExtensionApis();
		await this._config.load();

		let packageManager = await this.getPackageManager();

		this._apiWrapper.registerCommand(constants.mlManagePackagesCommand, (async () => {
			await packageManager.managePackages();
		}));
		try {
			await packageManager.installDependencies();
		} catch (err) {
			this._outputChannel.appendLine(err);
		}
	}

	/**
	 * Returns the package manager instance
	 */
	public async getPackageManager(): Promise<PackageManager> {
		if (!this._packageManager) {
			this._packageManager = new PackageManager(this._nbExtensionApis, this._outputChannel, this._rootPath, this._apiWrapper, this._queryRunner, this._processService, this._config);
			this._packageManager.init();
		}
		return this._packageManager;
	}

	/**
	 * Package manager instance
	 */
	public set packageManager(value: PackageManager) {
		this._packageManager = value;
	}

	/**
	 * Config instance
	 */
	public get config(): Config {
		return this._config;
	}

	/**
	 * Disposes the extension
	 */
	public dispose(): void {
		this.deactivate();
	}
}
