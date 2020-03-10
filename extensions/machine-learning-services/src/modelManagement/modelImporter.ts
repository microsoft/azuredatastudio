/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProcessService } from '../common/processService';
import { Config } from '../configurations/config';
import { ApiWrapper } from '../common/apiWrapper';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as utils from '../common/utils';
import { PackageManager } from '../packageManagement/packageManager';
import * as constants from '../common/constants';

/**
 * Service to import model to database
 */
export class ModelImporter {

	/**
	 *
	 */
	constructor(private _outputChannel: vscode.OutputChannel, private _apiWrapper: ApiWrapper, private _processService: ProcessService, private _config: Config, private _packageManager: PackageManager) {
	}

	public async registerModel(connection: azdata.connection.ConnectionProfile, modelFolderPath: string): Promise<void> {
		await this.installDependencies();
		await this.executeScripts(connection, modelFolderPath);
	}

	/**
	 * Installs dependencies for model importer
	 */
	public async installDependencies(): Promise<void> {
		await utils.executeTasks(this._apiWrapper, constants.installDependenciesMsgTaskName, [
			this._packageManager.installRequiredPythonPackages(this._config.modelsRequiredPythonPackages)], true);
	}

	protected async executeScripts(connection: azdata.connection.ConnectionProfile, modelFolderPath: string): Promise<void> {

		const parts = modelFolderPath.split('\\');
		modelFolderPath = parts.join('/');

		let credentials = await this._apiWrapper.getCredentials(connection.connectionId);

		if (connection) {
			let server = connection.serverName;

			const experimentId = `ads_ml_experiment_${UUID.generateUuid()}`;
			const credential = connection.userName ? `${connection.userName}:${credentials[azdata.ConnectionOptionSpecialType.password]}@` : '';
			let scripts: string[] = [
				'import mlflow.onnx',
				'import onnx',
				'from mlflow.tracking.client import MlflowClient',
				`onx = onnx.load("${modelFolderPath}")`,
				'client = MlflowClient()',
				`exp_name = "${experimentId}"`,
				`db_uri_artifact = "mssql+pyodbc://${credential}${server}/MlFlowDB?driver=ODBC+Driver+17+for+SQL+Server&"`,
				'client.create_experiment(exp_name, artifact_location=db_uri_artifact)',
				'mlflow.set_experiment(exp_name)',
				'mlflow.onnx.log_model(onx, "pipeline_vectorize")'
			];
			let pythonExecutable = this._config.pythonExecutable;
			await this._processService.execScripts(pythonExecutable, scripts, [], this._outputChannel);
		}
	}
}
