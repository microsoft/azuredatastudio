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
		try {
			let livyUrl: string = `https://${submissionArgs.host}:${submissionArgs.port}${submissionArgs.livyPath}/`;

			// Get correct authentication headers
			let headers = await this.getAuthenticationHeaders(submissionArgs);

			let options: request.XHROptions = {
				url: livyUrl,
				type: 'POST',
				strictSSL: !auth.getIgnoreSslVerificationConfigSetting(),
				data: {
					file: submissionArgs.sparkFile,
					proxyUser: submissionArgs.user,
					className: submissionArgs.mainClass,
					name: submissionArgs.jobName
				},
				// authentication headers
				headers: headers
			};

			// Set arguments
			if (submissionArgs.jobArguments && submissionArgs.jobArguments.trim()) {
				let argsList = submissionArgs.jobArguments.split(' ');
				if (argsList.length > 0) {
					options.data['args'] = argsList;
				}
			}

			// Set jars files
			if (submissionArgs.jarFileList && submissionArgs.jarFileList.trim()) {
				let jarList = submissionArgs.jarFileList.split(';');
				if (jarList.length > 0) {
					options.data['jars'] = jarList;
				}
			}

			// Set py files
			if (submissionArgs.pyFileList && submissionArgs.pyFileList.trim()) {
				let pyList = submissionArgs.pyFileList.split(';');
				if (pyList.length > 0) {
					options.data['pyFiles'] = pyList;
				}
			}

			// Set other files
			if (submissionArgs.otherFileList && submissionArgs.otherFileList.trim()) {
				let otherList = submissionArgs.otherFileList.split(';');
				if (otherList.length > 0) {
					options.data['files'] = otherList;
				}
			}

			options.data = JSON.stringify(options.data);

			// Note this is currently required to be called each time since request-light is overwriting
			// the setting passed in through the options. If/when that gets fixed this can be removed
			request.configure(null, !auth.getIgnoreSslVerificationConfigSetting());

			const response = JSON.parse((await request.xhr(options)).responseText);
			if (response && utils.isValidNumber(response.id)) {
				return response.id;
			}

			return Promise.reject(new Error(localize('sparkJobSubmission.LivyNoBatchIdReturned',
				"No Spark job batch id is returned from response.{0}[Error] {1}", os.EOL, JSON.stringify(response))));
		} catch (error) {
			return Promise.reject(error);
		}
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
		try {
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

			return Promise.reject(localize('sparkJobSubmission.LivyNoLogReturned',
				"No log is returned within response.{0}[Error] {1}", os.EOL, JSON.stringify(response)));
		} catch (error) {
			return Promise.reject(error);
		}
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
		private readonly _jobName: string,
		private readonly _sparkFile: string,
		private readonly _mainClass: string,
		private readonly _arguments: string,
		private readonly _jarFileList: string,
		private readonly _pyFileList: string,
		private readonly _otherFileList: string,
		private _host?: string,
		private _port?: number,
		private _livyPath?: string,
		private _user?: string,
		private _password?: string,
		private _isIntegratedAuth?: boolean) {
	}

	public get jobName(): string { return this._jobName; }
	public get sparkFile(): string { return this._sparkFile; }
	public get mainClass(): string { return this._mainClass; }
	public get jobArguments(): string { return this._arguments; }
	public get jarFileList(): string { return this._jarFileList; }
	public get otherFileList(): string { return this._otherFileList; }
	public get pyFileList(): string { return this._pyFileList; }
	public get host(): string { return this._host; }
	public get port(): number { return this._port; }
	public get livyPath(): string { return this._livyPath; }
	public get user(): string { return this._user; }
	public get password(): string { return this._password; }
	public get isIntegratedAuth(): boolean { return this._isIntegratedAuth; }
}

export enum SparkFileSource {
	HDFS = <any>'HDFS',
	Local = <any>'Local'
}

export class LivyLogResponse {
	constructor(public log: string, public appId: string) { }
}
