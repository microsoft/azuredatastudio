/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
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
	sqlCmdVariables?: Map<string, string>;
	deploymentOptions?: DeploymentOptions;
	publishProfileUri?: vscode.Uri;
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

