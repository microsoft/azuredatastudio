/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();
import * as fspath from 'path';
import * as os from 'os';

import * as constants from '../../../constants';
import { SqlClusterConnection } from '../../../objectExplorerNodeProvider/connection';
import * as LocalizedConstants from '../../../localizedConstants';
import * as utils from '../../../utils';
import { SparkJobSubmissionService, SparkJobSubmissionInput, LivyLogResponse } from './sparkJobSubmissionService';
import { AppContext } from '../../../appContext';
import { IFileSource, File, joinHdfsPath } from '../../../objectExplorerNodeProvider/fileSources';


// Stores important state and service methods used by the Spark Job Submission Dialog.
export class SparkJobSubmissionModel {
	private _dialogService: SparkJobSubmissionService;
	private _guidForClusterFolder: string;
	public get guidForClusterFolder(): string { return this._guidForClusterFolder; }

	// Whether the file is from local or HDFS
	public isMainSourceFromLocal: boolean;

	// indicate the final path to be submitted within HDFS
	public hdfsSubmitFilePath: string;

	// local file uploading related path: source; destinationFolder
	public localFileSourcePath: string;
	public hdfsFolderDestinationPath: string;

	constructor(
		private readonly _sqlClusterConnection: SqlClusterConnection,
		private readonly _dialog: azdata.window.Dialog,
		private readonly _appContext: AppContext,
		requestService?: (args: any) => any) {

		if (!this._sqlClusterConnection || !this._dialog || !this._appContext) {
			throw new Error(localize('sparkJobSubmission_SparkJobSubmissionModelInitializeError',
				'Parameters for SparkJobSubmissionModel is illegal'));
		}

		this._dialogService = new SparkJobSubmissionService(requestService);
		this._guidForClusterFolder = utils.generateGuid();
	}

	public get connection(): SqlClusterConnection { return this._sqlClusterConnection; }
	public get dialogService(): SparkJobSubmissionService { return this._dialogService; }
	public get dialog(): azdata.window.Dialog { return this._dialog; }

	public isJarFile(): boolean {
		if (this.hdfsSubmitFilePath) {
			return this.hdfsSubmitFilePath.toLowerCase().endsWith('jar');
		}

		return false;
	}

	public showDialogError(message: string): void {
		let errorLevel = azdata.window.MessageLevel ? azdata.window.MessageLevel : 0;
		this._dialog.message = {
			text: message,
			level: <azdata.window.MessageLevel>errorLevel
		};
	}

	public showDialogInfo(message: string): void {
		let infoLevel = azdata.window.MessageLevel ? azdata.window.MessageLevel.Information : 2;
		this._dialog.message = {
			text: message,
			level: infoLevel
		};
	}

	public getSparkClusterUrl(): string {
		if (this._sqlClusterConnection && this._sqlClusterConnection.host && this._sqlClusterConnection.port) {
			return `https://${this._sqlClusterConnection.host}:${this._sqlClusterConnection.port}`;
		}

		// Only for safety check, Won't happen with correct Model initialize.
		return '';
	}

	public async submitBatchJobByLivy(submissionArgs: SparkJobSubmissionInput): Promise<string> {
		try {
			if (!submissionArgs) {
				return Promise.reject(localize('sparkJobSubmission_submissionArgsIsInvalid', 'submissionArgs is invalid. '));
			}

			submissionArgs.setSparkClusterInfo(this._sqlClusterConnection);
			let livyBatchId = await this._dialogService.submitBatchJob(submissionArgs);
			return livyBatchId;
		} catch (error) {
			return Promise.reject(error);
		}
	}

	public async getApplicationID(submissionArgs: SparkJobSubmissionInput, livyBatchId: string, retryTime?: number): Promise<string> {
		// TODO: whether set timeout as 15000ms
		try {
			if (!submissionArgs) {
				return Promise.reject(localize('sparkJobSubmission_submissionArgsIsInvalid', 'submissionArgs is invalid. '));
			}

			if (!utils.isValidNumber(livyBatchId)) {
				return Promise.reject(new Error(localize('sparkJobSubmission_LivyBatchIdIsInvalid', 'livyBatchId is invalid. ')));
			}

			if (!retryTime) {
				retryTime = constants.mssqlClusterLivyRetryTimesForCheckYarnApp;
			}

			submissionArgs.setSparkClusterInfo(this._sqlClusterConnection);
			let response: LivyLogResponse = undefined;
			let timeOutCount: number = 0;
			do {
				timeOutCount++;
				await this.sleep(constants.mssqlClusterLivyTimeInMSForCheckYarnApp);
				response = await this._dialogService.getYarnAppId(submissionArgs, livyBatchId);
			} while (response.appId === '' && timeOutCount < retryTime);

			if (response.appId === '') {
				return Promise.reject(localize('sparkJobSubmission_GetApplicationIdTimeOut', 'Get Application Id time out. {0}[Log]   {1}', os.EOL, response.log));
			} else {
				return response.appId;
			}
		} catch (error) {
			return Promise.reject(error);
		}
	}

	public async uploadFile(localFilePath: string, hdfsFolderPath: string): Promise<void> {
		try {
			if (!localFilePath || !hdfsFolderPath) {
				return Promise.reject(localize('sparkJobSubmission_localFileOrFolderNotSpecified.', 'Property localFilePath or hdfsFolderPath is not specified. '));
			}

			if (!(await utils.exists(localFilePath))) {
				return Promise.reject(LocalizedConstants.sparkJobSubmissionLocalFileNotExisted(localFilePath));
			}

			let fileSource: IFileSource = await this._sqlClusterConnection.createHdfsFileSource();
			await fileSource.writeFile(new File(localFilePath, false), hdfsFolderPath);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	public async isClusterFileExisted(path: string): Promise<boolean> {
		try {
			if (!path) {
				return Promise.reject(localize('sparkJobSubmission_PathNotSpecified.', 'Property Path is not specified. '));
			}

			let fileSource: IFileSource = await this._sqlClusterConnection.createHdfsFileSource();
			return await fileSource.exists(path);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	public updateModelByLocalPath(localPath: string): void {
		if (localPath) {
			this.localFileSourcePath = localPath;
			this.hdfsFolderDestinationPath = this.generateDestinationFolder();
			let fileName = fspath.basename(localPath);
			this.hdfsSubmitFilePath = joinHdfsPath(this.hdfsFolderDestinationPath, fileName);
		} else {
			this.hdfsSubmitFilePath = '';
		}
	}

	// Example path: /SparkSubmission/2018/08/21/b682a6c4-1954-401e-8542-9c573d69d9c0/default_artifact.jar
	private generateDestinationFolder(): string {
		let day = new Date();
		return `/SparkSubmission/${day.getUTCFullYear()}/${day.getUTCMonth() + 1}/${day.getUTCDate()}/${this._guidForClusterFolder}`;
	}

	// Example: https://host:30443/gateway/default/yarn/cluster/app/application_1532646201938_0057
	public generateYarnUIUrl(submissionArgs: SparkJobSubmissionInput, appId: string): string {
		return `https://${submissionArgs.host}:${submissionArgs.port}/gateway/default/yarn/cluster/app/${appId}`;
	}

	// Example: https://host:30443/gateway/default/yarn/proxy/application_1532646201938_0411
	public generateSparkTrackingUIUrl(submissionArgs: SparkJobSubmissionInput, appId: string): string {
		return `https://${submissionArgs.host}:${submissionArgs.port}/gateway/default/yarn/proxy/${appId}`;
	}

	// Example: https://host:30443/gateway/default/sparkhistory/history/application_1532646201938_0057/1
	public generateSparkHistoryUIUrl(submissionArgs: SparkJobSubmissionInput, appId: string): string {
		return `https://${submissionArgs.host}:${submissionArgs.port}/gateway/default/sparkhistory/history/${appId}/1`;
	}

	private async sleep(ms: number): Promise<{}> {
		// tslint:disable-next-line no-string-based-set-timeout
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
