/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdataType from 'azdata';
import { ISqlProjectPublishSettings, ISqlConnectionProperties } from 'sqldbproj';
import { IAzureAccountSession } from 'vscode-mssql';

export enum AppSettingType {
	None,
	AzureFunction
}

export interface ISqlDbDeployProfile {
	sqlDbSetting?: ISqlDbSetting;
	deploySettings?: ISqlProjectPublishSettings;
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

