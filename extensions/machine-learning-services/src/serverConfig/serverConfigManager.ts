/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { QueryRunner } from '../common/queryRunner';
import * as constants from '../common/constants';
import { ApiWrapper } from '../common/apiWrapper';
import * as utils from '../common/utils';

export class ServerConfigManager {

	/**
	 * Creates a new instance of ServerConfigManager
	 */
	constructor(
		private _apiWrapper: ApiWrapper,
		private _queryRunner: QueryRunner,
	) {
	}

	/**
	 * Opens server config documents
	 */
	public async openDocuments(): Promise<boolean> {
		return await this._apiWrapper.openExternal(vscode.Uri.parse(constants.mlsDocuments));
	}

	/**
	 * Opens ODBC driver documents
	 */
	public async openOdbcDriverDocuments(): Promise<boolean> {
		if (utils.isWindows()) {
			return await this._apiWrapper.openExternal(vscode.Uri.parse(constants.odbcDriverWindowsDocuments));
		} else {
			return await this._apiWrapper.openExternal(vscode.Uri.parse(constants.odbcDriverLinuxDocuments));
		}
	}

	/**
	 * Opens install MLS documents
	 */
	public async openInstallDocuments(): Promise<boolean> {
		if (utils.isWindows()) {
			return await this._apiWrapper.openExternal(vscode.Uri.parse(constants.installMlsWindowsDocs));
		} else {
			return await this._apiWrapper.openExternal(vscode.Uri.parse(constants.installMlsLinuxDocs));
		}
	}

	/**
	 * Returns true if mls is installed in the give SQL server instance
	 */
	public async isMachineLearningServiceEnabled(connection: azdata.connection.ConnectionProfile): Promise<boolean> {
		return this._queryRunner.isMachineLearningServiceEnabled(connection);
	}

	/**
	 * Returns true if R installed in the give SQL server instance
	 */
	public async isRInstalled(connection: azdata.connection.ConnectionProfile): Promise<boolean> {
		return this._queryRunner.isRInstalled(connection);
	}

	/**
	 * Returns true if python installed in the give SQL server instance
	 */
	public async isPythonInstalled(connection: azdata.connection.ConnectionProfile): Promise<boolean> {
		return this._queryRunner.isPythonInstalled(connection);
	}

	/**
	 * Updates external script config
	 * @param connection SQL Connection
	 * @param enable if true external script will be enabled
	 */
	public async updateExternalScriptConfig(connection: azdata.connection.ConnectionProfile, enable: boolean): Promise<boolean> {
		await this._queryRunner.updateExternalScriptConfig(connection, enable);
		let current = await this._queryRunner.isMachineLearningServiceEnabled(connection);
		if (current === enable) {
			this._apiWrapper.showInfoMessage(enable ? constants.mlsEnabledMessage : constants.mlsDisabledMessage);
		} else {
			this._apiWrapper.showErrorMessage(constants.mlsConfigUpdateFailed);
		}

		return current;
	}
}
