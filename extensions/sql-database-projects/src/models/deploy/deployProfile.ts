/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDeploySettings } from '../IDeploySettings';

export enum AppSettingType {
	None,
	AzureFunction
}
export interface IDeployProfile {
	localDbSetting?: ILocalDbSetting;
	deploySettings?: IDeploySettings;
}

export interface IDeployAppIntegrationProfile {
	envVariableName?: string;
	appSettingFile?: string;
	appSettingType: AppSettingType;
}

export interface ILocalDbSetting {
	serverName: string,
	port: number,
	userName: string,
	password: string,
	dbName: string,
	dockerBaseImage: string,
	connectionRetryTimeout?: number,
	profileName?: string
}
