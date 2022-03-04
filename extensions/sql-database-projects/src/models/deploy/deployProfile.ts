/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDeploySettings } from '../IDeploySettings';
import type * as azdataType from 'azdata';
//import { AzureSubscription } from '../../../azure-account.api';
import { ResourceGroup } from '@azure/arm-resources/esm/models';
import * as coreAuth from '@azure/core-auth';
import { SubscriptionWithSession } from './azureSqlClient';

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
	subscription: SubscriptionWithSession,
	resourceGroup: ResourceGroup,
	location: string
}

export interface ILocalDbSetting extends ISqlConnectionProperties {
	dockerBaseImage: string,
	dockerBaseImageEula: string,
}

export interface ISqlConnectionProperties {
	accountId?: string
	serverName: string,
	userName: string,
	password: string,
	port: number,
	dbName: string,
	profileName?: string,
	connectionRetryTimeout?: number,
	accessToken?: coreAuth.AccessToken
}

export interface DockerImageInfo {
	name: string,
	displayName: string,
	agreementInfo: AgreementInfo
}
export interface AgreementInfo {
	link: azdataType.LinkArea;
}

