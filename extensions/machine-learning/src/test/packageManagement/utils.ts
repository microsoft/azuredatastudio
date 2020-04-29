/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../../common/apiWrapper';
import { QueryRunner } from '../../common/queryRunner';
import { ProcessService } from '../../common/processService';
import { Config } from '../../configurations/config';
import { HttpClient } from '../../common/httpClient';
import * as utils from '../utils';
import { PackageManagementService } from '../../packageManagement/packageManagementService';

export interface TestContext {

	outputChannel: vscode.OutputChannel;
	processService: TypeMoq.IMock<ProcessService>;
	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	queryRunner: TypeMoq.IMock<QueryRunner>;
	config: TypeMoq.IMock<Config>;
	op: azdata.BackgroundOperation;
	getOpStatus: () => azdata.TaskStatus;
	httpClient: TypeMoq.IMock<HttpClient>;
	serverConfigManager: TypeMoq.IMock<PackageManagementService>;
}

export function createContext(): TestContext {
	const context = utils.createContext();

	return {

		outputChannel: context.outputChannel,
		processService: TypeMoq.Mock.ofType(ProcessService),
		apiWrapper: TypeMoq.Mock.ofType(ApiWrapper),
		queryRunner: TypeMoq.Mock.ofType(QueryRunner),
		config: TypeMoq.Mock.ofType(Config),
		httpClient: TypeMoq.Mock.ofType(HttpClient),
		op: context.op,
		getOpStatus: context.getOpStatus,
		serverConfigManager: TypeMoq.Mock.ofType(PackageManagementService)
	};
}
