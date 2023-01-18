/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();
import * as constants from '../../../constants';
import { SqlClusterConnection } from '../../../objectExplorerNodeProvider/connection';
import * as utils from '../../../utils';
import * as auth from '../../../util/auth';
import * as request from 'request-light';

export class SparkJobSubmissionService {
	public async submitBatchJob(submissionArgs: SparkJobSubmissionInput): Promise<string> {
		let livyUrl: string = `https://${submissionArgs.host}:${submissionArgs.port}${submissionArgs.livyPath}/`;

		// Get correct authentication headers
		let headers = await this.getAuthenticationHeaders(submissionArgs);

		let options: request.XHROptions = {
			url: livyUrl,
			type: 'POST',
			strictSSL: !auth.getIgnoreSslVerificationConfigSetting(),
			data: {
				file: submissionArgs.config.sparkFile,
				proxyUser: submissionArgs.user,
				className: submissionArgs.config.mainClass,
				name: submissionArgs.config.jobName
			},
			// authentication headers
			headers: headers
		};

		// Now set the other parameters based on the user configuration - see
		// https://livy.incubator.apache.org/docs/latest/rest-api.html for more detailed information

		// Set arguments
		const args = submissionArgs.config.arguments?.trim();
		if (arguments) {
			const argsList = args.split(' ');
			if (argsList.length > 0) {
				options.data['args'] = argsList;
			}
		}

		// Set jars files
		const jarFiles = submissionArgs.config.jarFiles?.trim();
		if (jarFiles) {
			const jarList = jarFiles.split(';');
			if (jarList.length > 0) {
				options.data['jars'] = jarList;
			}
		}

		// Set py files
		if (submissionArgs.config.pyFiles?.trim()) {
			const pyList = submissionArgs.config.pyFiles.split(';');
			if (pyList.length > 0) {
				options.data['pyFiles'] = pyList;
			}
		}

		// Set other files
		const otherFiles = submissionArgs.config.otherFiles?.trim();
		if (otherFiles) {
			const otherList = otherFiles.split(';');
			if (otherList.length > 0) {
				options.data['files'] = otherList;
			}
		}

		// Set driver memory
		const driverMemory = submissionArgs.config.driverMemory?.trim();
		if (driverMemory) {
			options.data['driverMemory'] = driverMemory;
		}

		// Set driver cores
		if (submissionArgs.config.driverCores) {
			options.data['driverCores'] = submissionArgs.config.driverCores;
		}

		// Set executor memory
		const executorMemory = submissionArgs.config.executorMemory?.trim();
		if (executorMemory) {
			options.data['executorMemory'] = executorMemory;
		}

		// Set executor cores
		if (submissionArgs.config.executorCores) {
			options.data['executorCores'] = submissionArgs.config.executorCores;
		}

		// Set executor count
		if (submissionArgs.config.executorCount) {
			options.data['numExecutors'] = submissionArgs.config.executorCount;
		}

		if (submissionArgs.config.queueName) {
			options.data['queue'] = submissionArgs.config.queueName;
		}
		// Set driver memory
		const configurationValues = submissionArgs.config.configValues?.trim();
		if (configurationValues) {
			options.data['conf'] = configurationValues;
		}

		options.data = JSON.stringify(options.data);

		// Note this is currently required to be called each time since request-light is overwriting
		// the setting passed in through the options. If/when that gets fixed this can be removed
		request.configure(null, !auth.getIgnoreSslVerificationConfigSetting());

		const response = JSON.parse((await request.xhr(options)).responseText);
		if (response && utils.isValidNumber(response.id)) {
			return response.id;
		}

		throw new Error(localize('sparkJobSubmission.LivyNoBatchIdReturned',
			"No Spark job batch id is returned from response.{0}[Error] {1}", os.EOL, JSON.stringify(response)));
	}

	private async getAuthenticationHeaders(submissionArgs: SparkJobSubmissionInput) {
		let headers = {};
		if (submissionArgs.isIntegratedAuth) {
			let kerberosToken = await auth.authenticateKerberos(submissionArgs.host);
			headers = { Authorization: `Negotiate ${kerberosToken}` };
		}
		else {
			headers = { Authorization: 'Basic ' + Buffer.from(submissionArgs.user + ':' + submissionArgs.password).toString('base64') };
		}
		return headers;
	}

	public async getYarnAppId(submissionArgs: SparkJobSubmissionInput, livyBatchId: string): Promise<LivyLogResponse> {
		let livyUrl = `https://${submissionArgs.host}:${submissionArgs.port}${submissionArgs.livyPath}/${livyBatchId}/log`;
		let headers = await this.getAuthenticationHeaders(submissionArgs);

		let options: request.XHROptions = {
			url: livyUrl,
			type: 'GET',
			strictSSL: !auth.getIgnoreSslVerificationConfigSetting(),
			// authentication headers
			headers: headers
		};

		// Note this is currently required to be called each time since request-light is overwriting
		// the setting passed in through the options. If/when that gets fixed this can be removed
		request.configure(null, !auth.getIgnoreSslVerificationConfigSetting());

		const response = JSON.parse((await request.xhr(options)).responseText);
		if (response && response.log) {
			return this.extractYarnAppIdFromLog(response.log);
		}

		throw new Error(localize('sparkJobSubmission.LivyNoLogReturned',
			"No log is returned within response.{0}[Error] {1}", os.EOL, JSON.stringify(response)));
	}


	private extractYarnAppIdFromLog(log: any): LivyLogResponse {
		let logForPrint = log;
		if (Array.isArray(log)) {
			logForPrint = log.join(os.EOL);
		}

		// eg: '18/08/23 11:02:50 INFO yarn.Client: Application report for application_1532646201938_0182 (state: ACCEPTED)'
		for (let entry of log) {
			if (entry.indexOf('Application report for') >= 0 && entry.indexOf('(state: ACCEPTED)') >= 0) {
				let tokens = entry.split(' ');
				for (let token of tokens) {
					if (token.startsWith('application_')) {
						return new LivyLogResponse(logForPrint, token);
					}
				}
			}
		}

		return new LivyLogResponse(logForPrint, '');
	}
}

/**
 * The configuration values for the spark job submission. See https://livy.incubator.apache.org/docs/latest/rest-api.html
 * for more detailed information.
 */
export interface SparkJobSubmissionConfig {
	readonly jobName: string,
	readonly sparkFile: string,
	readonly mainClass: string,
	readonly arguments?: string,
	readonly jarFiles?: string,
	readonly pyFiles?: string,
	readonly otherFiles?: string,
	readonly driverMemory?: string,
	readonly driverCores?: number,
	readonly executorMemory?: string,
	readonly executorCores?: number,
	readonly executorCount?: number,
	readonly queueName?: string,
	readonly configValues?: string
}

export class SparkJobSubmissionInput {
	public setSparkClusterInfo(sqlClusterConnection: SqlClusterConnection): void {
		this._host = sqlClusterConnection.host;
		this._port = sqlClusterConnection.port;
		this._livyPath = constants.mssqlClusterLivySubmitPath;
		this._user = sqlClusterConnection.user;
		this._password = sqlClusterConnection.password;
		this._isIntegratedAuth = sqlClusterConnection.isIntegratedAuth();
	}

	constructor(
		public readonly config: SparkJobSubmissionConfig,
		private _host?: string,
		private _port?: number,
		private _livyPath?: string,
		private _user?: string,
		private _password?: string,
		private _isIntegratedAuth?: boolean) { }

	public get host(): string { return this._host; }
	public get port(): number { return this._port; }
	public get livyPath(): string { return this._livyPath; }
	public get user(): string { return this._user; }
	public get password(): string { return this._password; }
	public get isIntegratedAuth(): boolean { return this._isIntegratedAuth; }
}

export enum SparkFileSource {
	HDFS = 'HDFS',
	Local = 'Local'
}

export class LivyLogResponse {
	constructor(public log: string, public appId: string) { }
}
