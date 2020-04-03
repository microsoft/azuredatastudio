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
import * as nbExtensionApis from '../typings/notebookServices';

export class PackageManagementService {

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
	public async enableExternalScriptConfig(connection: azdata.connection.ConnectionProfile): Promise<boolean> {
		let current = await this._queryRunner.isMachineLearningServiceEnabled(connection);

		if (current) {
			return current;
		}
		let confirmed = await utils.promptConfirm(constants.confirmEnableExternalScripts, this._apiWrapper);
		if (confirmed) {
			await this._queryRunner.updateExternalScriptConfig(connection, true);
			current = await this._queryRunner.isMachineLearningServiceEnabled(connection);
			if (current) {
				this._apiWrapper.showInfoMessage(constants.mlsEnabledMessage);
			} else {
				this._apiWrapper.showErrorMessage(constants.mlsConfigUpdateFailed);
			}
		} else {
			this._apiWrapper.showErrorMessage(constants.externalScriptsIsRequiredError);
		}

		return current;
	}

	/**
	 * Returns python packages installed in SQL server instance
	 * @param connection SQL Connection
	 */
	public async getPythonPackages(connection: azdata.connection.ConnectionProfile): Promise<nbExtensionApis.IPackageDetails[]> {
		return this._queryRunner.getPythonPackages(connection);
	}

	/**
	 * Returns python packages installed in SQL server instance
	 * @param connection SQL Connection
	 */
	public async getRPackages(connection: azdata.connection.ConnectionProfile): Promise<nbExtensionApis.IPackageDetails[]> {
		return this._queryRunner.getRPackages(connection);
	}
}
