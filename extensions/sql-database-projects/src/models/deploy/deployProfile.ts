/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDeploySettings } from '../IDeploySettings';
import type * as azdataType from 'azdata';
import { IAzureAccountSession } from 'vscode-mssql';

export enum AppSettingType {
	None,
	AzureFunction
}
export interface ILocalDbDeployProfile {
	localDbSetting?: ILocalDbSetting;
	deploySettings?: IDeploySettings;
}

export interface ISqlDbDeployProfile {
	sqlDbSetting?: ISqlDbSetting;
	deploySettings?: IDeploySettings;
}

export interface IDeployAppIntegrationProfile {
	envVariableName?: string;
	appSettingFile?: string;
	appSettingType: AppSettingType;
}

export interface ISqlDbSetting extends ISqlConnectionProperties {
	session: IAzureAccountSession
	resourceGroupName: string,
	location: string
}

export interface ILocalDbSetting extends ISqlConnectionProperties {
	dockerBaseImage: string,
	dockerBaseImageEula: string,
}

export interface ISqlConnectionProperties {
	tenantId?: string,
	accountId?: string
	serverName: string,
	userName: string,
	password: string,
	port: number,
	dbName: string,
	profileName?: string,
	connectionRetryTimeout?: number
}

export interface DockerImageInfo {
	name: string,
	displayName: string,
	agreementInfo: AgreementInfo,
	tagsUrl: string,
	defaultTag: string
}
export interface AgreementInfo {
	link: azdataType.LinkArea;
}

