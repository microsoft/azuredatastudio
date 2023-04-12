/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISqlConnectionProperties } from 'sqldbproj';
import { DeploymentOptions as mssqlDeploymentOptions } from 'mssql';
import { DeploymentOptions as vscodeMssqlDeploymentOptions } from 'vscode-mssql';

export type DeploymentOptions = mssqlDeploymentOptions | vscodeMssqlDeploymentOptions;

/**
 * Settings to use when publishing a SQL Project
 */
export interface ISqlProjectPublishSettings {
	databaseName: string;
	serverName: string;
	connectionUri: string;
	sqlCmdVariables?: Record<string, string>;
	deploymentOptions?: DeploymentOptions;
	profileUsed?: boolean;
}

/**
 * Settings for creating the docker container a project is being published to
 */
export interface IDockerSettings extends ISqlConnectionProperties {
	dockerBaseImage: string,
	dockerBaseImageEula: string,
}

/**
 * Settings for publishing a SQL Project to a docker container
 */
export interface IPublishToDockerSettings {
	dockerSettings: IDockerSettings;
	sqlProjectPublishSettings: ISqlProjectPublishSettings;
}

