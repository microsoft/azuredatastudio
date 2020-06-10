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
import * as os from 'os';
import { ModelParameters } from './interfaces';

/**
 * Python client for ONNX models
 */
export class ModelPythonClient {

	/**
	 * Creates new instance
	 */
	constructor(private _outputChannel: vscode.OutputChannel, private _apiWrapper: ApiWrapper, private _processService: ProcessService, private _config: Config, private _packageManager: PackageManager) {
	}

	/**
	 * Deploys models in the SQL database using mlflow
	 * @param connection
	 * @param modelPath
	 */
	public async deployModel(connection: azdata.connection.ConnectionProfile, modelPath: string): Promise<void> {
		await this.installDependencies();
		await this.executeDeployScripts(connection, modelPath);
	}

	/**
	 * Installs dependencies for python client
	 */
	public async installDependencies(): Promise<void> {
		await utils.executeTasks(this._apiWrapper, constants.installModelMngDependenciesMsgTaskName, [
			this._packageManager.installRequiredPythonPackages(this._config.modelsRequiredPythonPackages)], true);
	}

	/**
	 *
	 * @param modelPath Loads model parameters
	 */
	public async loadModelParameters(modelPath: string): Promise<ModelParameters> {
		return await this.executeModelParametersScripts(modelPath);
	}

	private async executeModelParametersScripts(modelFolderPath: string): Promise<ModelParameters> {
		modelFolderPath = utils.makeLinuxPath(modelFolderPath);

		let scripts: string[] = [
			'import onnx',
			'import json',
			`onnx_model_path = '${modelFolderPath}'`,
			`onnx_model = onnx.load_model(onnx_model_path)`,
			`type_list = ['undefined',
			'float', 'uint8', 'int8', 'uint16', 'int16', 'int32', 'int64', 'string', 'bool', 'double',
			'uint32', 'uint64', 'complex64', 'complex128', 'bfloat16']`,
			`type_map = {
				onnx.TensorProto.DataType.FLOAT: 'real',
				onnx.TensorProto.DataType.UINT8: 'tinyint',
				onnx.TensorProto.DataType.INT16: 'smallint',
				onnx.TensorProto.DataType.INT32: 'int',
				onnx.TensorProto.DataType.INT64: 'bigint',
				onnx.TensorProto.DataType.STRING: 'varchar(MAX)',
				onnx.TensorProto.DataType.DOUBLE: 'float'}`,
			`parameters = {
				"inputs": [],
				"outputs": []
			}`,
			`def addParameters(list, paramType):
			for id, p in enumerate(list):
				p_type = ''
				value = p.type.tensor_type.elem_type
				if value in type_map:
					p_type = type_map[value]
				name = type_list[value]
				parameters[paramType].append({
					'name': p.name,
					'type': p_type,
					'originalType': name
				})`,

			'addParameters(onnx_model.graph.input, "inputs")',
			'addParameters(onnx_model.graph.output, "outputs")',
			'print(json.dumps(parameters))'
		];
		let pythonExecutable = await this._config.getPythonExecutable(true);
		let output = await this._processService.execScripts(pythonExecutable, scripts, [], undefined);
		let parametersJson = JSON.parse(output);
		return Object.assign({}, parametersJson);
	}

	private async executeDeployScripts(connection: azdata.connection.ConnectionProfile, modelFolderPath: string): Promise<void> {
		let home = utils.makeLinuxPath(os.homedir());
		modelFolderPath = utils.makeLinuxPath(modelFolderPath);

		let credentials = await this._apiWrapper.getCredentials(connection.connectionId);

		if (connection) {
			let server = connection.serverName;

			const experimentId = `ads_ml_experiment_${UUID.generateUuid()}`;
			const credential = connection.userName ? `${connection.userName}:${credentials[azdata.ConnectionOptionSpecialType.password]}@` : '';
			let scripts: string[] = [
				'import mlflow.onnx',
				`tracking_uri = "file://${home}/mlruns"`,
				'print(tracking_uri)',
				'import onnx',
				'from mlflow.tracking.client import MlflowClient',
				`onx = onnx.load("${modelFolderPath}")`,
				`mlflow.set_tracking_uri(tracking_uri)`,
				'client = MlflowClient()',
				`exp_name = "${experimentId}"`,
				`db_uri_artifact = "mssql+pyodbc://${credential}${server}/MlFlowDB?driver=ODBC+Driver+17+for+SQL+Server&"`,
				'client.create_experiment(exp_name, artifact_location=db_uri_artifact)',
				'mlflow.set_experiment(exp_name)',
				'mlflow.onnx.log_model(onx, "pipeline_vectorize")'
			];
			let pythonExecutable = await this._config.getPythonExecutable(true);
			await this._processService.execScripts(pythonExecutable, scripts, [], this._outputChannel);
		}
	}
}
