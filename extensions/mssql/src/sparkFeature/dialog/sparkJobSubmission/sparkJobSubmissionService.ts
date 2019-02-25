/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as os from 'os';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();
import * as constants from '../../../constants';
import { SqlClusterConnection } from '../../../objectExplorerNodeProvider/connection';
import * as utils from '../../../utils';

export class SparkJobSubmissionService {
	private _requestPromise: (args: any) => any;

	constructor(
		requestService?: (args: any) => any) {
		if (requestService) {
			// this is to fake the request service for test.
			this._requestPromise = requestService;
		} else {
			this._requestPromise = require('request-promise');
		}
	}

	public async submitBatchJob(submissionArgs: SparkJobSubmissionInput): Promise<string> {
		try {
			let livyUrl: string = `https://${submissionArgs.host}:${submissionArgs.port}${submissionArgs.livyPath}/`;
			let options = {
				uri: livyUrl,
				method: 'POST',
				json: true,
				// TODO, change it back after service's authentication changed.
				rejectUnauthorized: false,
				body: {
					file: submissionArgs.sparkFile,
					proxyUser: submissionArgs.user,
					className: submissionArgs.mainClass,
					name: submissionArgs.jobName
				},
				// authentication headers
				headers: {
					'Authorization': 'Basic ' + new Buffer(submissionArgs.user + ':' + submissionArgs.password).toString('base64')
				}
			};

			// Set arguments
			if (submissionArgs.jobArguments && submissionArgs.jobArguments.trim()) {
				let argsList = submissionArgs.jobArguments.split(' ');
				if (argsList.length > 0) {
					options.body['args'] = argsList;
				}
			}

			// Set jars files
			if (submissionArgs.jarFileList && submissionArgs.jarFileList.trim()) {
				let jarList = submissionArgs.jarFileList.split(';');
				if (jarList.length > 0) {
					options.body['jars'] = jarList;
				}
			}

			// Set py files
			if (submissionArgs.pyFileList && submissionArgs.pyFileList.trim()) {
				let pyList = submissionArgs.pyFileList.split(';');
				if (pyList.length > 0) {
					options.body['pyFiles'] = pyList;
				}
			}

			// Set other files
			if (submissionArgs.otherFileList && submissionArgs.otherFileList.trim()) {
				let otherList = submissionArgs.otherFileList.split(';');
				if (otherList.length > 0) {
					options.body['files'] = otherList;
				}
			}

			const response = await this._requestPromise(options);
			if (response && utils.isValidNumber(response.id)) {
				return response.id;
			}

			return Promise.reject(new Error(localize('sparkJobSubmission_LivyNoBatchIdReturned',
				'No Spark job batch id is returned from response.{0}[Error] {1}', os.EOL, JSON.stringify(response))));
		} catch (error) {
			return Promise.reject(error);
		}
	}

	public async getYarnAppId(submissionArgs: SparkJobSubmissionInput, livyBatchId: string): Promise<LivyLogResponse> {
		try {
			let livyUrl = `https://${submissionArgs.host}:${submissionArgs.port}${submissionArgs.livyPath}/${livyBatchId}/log`;
			let options = {
				uri: livyUrl,
				method: 'GET',
				json: true,
				rejectUnauthorized: false,
				// authentication headers
				headers: {
					'Authorization': 'Basic ' + new Buffer(submissionArgs.user + ':' + submissionArgs.password).toString('base64')
				}
			};

			const response = await this._requestPromise(options);
			if (response && response.log) {
				return this.extractYarnAppIdFromLog(response.log);
			}

			return Promise.reject(localize('sparkJobSubmission_LivyNoLogReturned',
				'No log is returned within response.{0}[Error] {1}', os.EOL, JSON.stringify(response)));
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
		this._passWord = sqlClusterConnection.password;
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
		private _passWord?: string) {
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
	public get password(): string { return this._passWord; }
}

export enum SparkFileSource {
	HDFS = <any>'HDFS',
	Local = <any>'Local'
}

export class LivyLogResponse {
	constructor(public log: string, public appId: string) { }
}
