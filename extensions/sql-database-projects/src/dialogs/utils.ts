/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlTargetPlatform } from 'sqldbproj';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import * as mssql from 'mssql';
import { HttpClient } from '../common/httpClient';
import { AgreementInfo, DockerImageInfo } from '../models/deploy/deployProfile';
import { IUserDatabaseReferenceSettings } from '../models/IDatabaseReferenceSettings';
import { removeSqlCmdVariableFormatting } from '../common/utils';

/**
 * Gets connection name from connection object if there is one,
 * otherwise set connection name in format that shows in OE
 */
export function getConnectionName(connection: any): string {
	let connectionName: string;
	if (connection.options['connectionName']) {
		connectionName = connection.options['connectionName'];
	} else {
		let user = connection.options['user'];
		if (!user) {
			user = constants.defaultUser;
		}

		connectionName = `${connection.options['server']} (${user})`;
	}

	return connectionName;
}

export function getAgreementDisplayText(agreementInfo: AgreementInfo): string {
	return constants.eulaAgreementText(agreementInfo.link!.text);
}

/**
 * Returns the title for SQL server based on the target version
 */
export function getPublishServerName(target: string): string {
	return target === constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlAzure) ? constants.AzureSqlServerName : constants.SqlServerName;
}

/**
 * Returns the list of image tags for given target
 * @param imageInfo docker image info
 * @param target project target version
 * @param defaultTagFirst whether the default tag should be the first entry in the array
 * @returns image tags
 */
export async function getImageTags(imageInfo: DockerImageInfo, target: string, defaultTagFirst?: boolean): Promise<string[]> {
	let imageTags: string[] | undefined = [];
	const versionToImageTags: Map<number, string[]> = new Map<number, string[]>();

	try {
		const imageTagsFromUrl = await HttpClient.getRequest(imageInfo?.tagsUrl, true);
		if (imageTagsFromUrl?.tags) {

			// Create a map for version and tags and find the max version in the list
			let defaultVersion: number = 0;
			let maxVersionNumber: number = defaultVersion;
			(imageTagsFromUrl.tags as string[]).forEach(imageTag => {
				const version = utils.findSqlVersionInImageName(imageTag) || defaultVersion;
				let tags = versionToImageTags.has(version) ? versionToImageTags.get(version) : [];
				tags = tags ?? [];
				tags = tags?.concat(imageTag);
				versionToImageTags.set(version, tags);
				maxVersionNumber = version && version > maxVersionNumber ? version : maxVersionNumber;
			});

			// Find the version maps to the target framework and default to max version in the tags
			const targetVersion = utils.findSqlVersionInTargetPlatform(constants.getTargetPlatformFromVersion(target)) || maxVersionNumber;

			// Get the image tags with no version of the one that matches project platform
			versionToImageTags.forEach((tags: string[], version: number) => {
				if (version === defaultVersion || version >= targetVersion) {
					imageTags = imageTags?.concat(tags);
				}
			});

			imageTags = imageTags ?? [];
			imageTags = imageTags.sort((a, b) => a.indexOf(constants.dockerImageDefaultTag) > 0 ? -1 : a.localeCompare(b));

			if (defaultTagFirst) {
				const defaultIndex = imageTags.findIndex(i => i === imageInfo.defaultTag);
				if (defaultIndex > -1) {
					imageTags.splice(defaultIndex, 1);
					imageTags.unshift(imageInfo.defaultTag);
				}
			}
		}
	} catch (err) {
		// Ignore the error. If http request fails, we just use the default tag
		console.debug(`Failed to get docker image tags ${err}`);
	}

	return imageTags;
}

/**
 * Returns the base image for given target version
 * @param target
 * @returns image info
 */
export function getDockerBaseImage(target: string): DockerImageInfo {
	if (target === constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlAzure)) {
		return {
			name: `${constants.sqlServerDockerRegistry}/${constants.sqlServerDockerRepository}`,
			displayName: constants.AzureSqlDbFullDockerImageName,
			agreementInfo: {
				link: {
					text: constants.eulaAgreementTitle,
					url: constants.sqlServerEulaLink,
				}
			},
			tagsUrl: `https://${constants.sqlServerDockerRegistry}/v2/${constants.sqlServerDockerRepository}/tags/list`,
			defaultTag: constants.dockerImageDefaultTag
		};
	} else {
		return {
			name: `${constants.sqlServerDockerRegistry}/${constants.sqlServerDockerRepository}`,
			displayName: constants.SqlServerDockerImageName,
			agreementInfo: {
				link: {
					text: constants.eulaAgreementTitle,
					url: constants.sqlServerEulaLink,
				}
			},
			tagsUrl: `https://${constants.sqlServerDockerRegistry}/v2/${constants.sqlServerDockerRepository}/tags/list`,
			defaultTag: constants.dockerImageDefaultTag
		};
	}
}

/**
 * This adds the tag matching the target platform to make sure the correct image is used for the project's target platform when the docker base image is SQL Server.
 * If the image is Edge, then no tag is appended
 * @param projectTargetVersion target version of the project
 * @param dockerImage selected base docker image without tag
 * @param imageInfo docker image info of the selected docker image
 * @returns dockerBaseImage with the appropriate image tag appended if there is one
 */
export function getDefaultDockerImageWithTag(projectTargetVersion: string, dockerImage: string, imageInfo?: DockerImageInfo,): string {
	if (imageInfo?.displayName === constants.SqlServerDockerImageName) {
		switch (projectTargetVersion) {
			case constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlServer2022):
				dockerImage = `${dockerImage}:2022-latest`;
				break;
			case constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlServer2019):
				dockerImage = `${dockerImage}:2019-latest`;
				break;
			case constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlServer2017):
				dockerImage = `${dockerImage}:2017-latest`;
				break;
			default:
				// nothing - let it be the default image defined as default in the container registry
				break;
		}
	}

	return dockerImage;
}

/**
 * Function to map folder structure string to enum
 * @param inputTarget folder structure in string
 * @returns folder structure in enum format
 */
export function mapExtractTargetEnum(inputTarget: string): mssql.ExtractTarget {
	if (inputTarget) {
		switch (inputTarget) {
			case constants.file: return mssql.ExtractTarget.file;
			case constants.flat: return mssql.ExtractTarget.flat;
			case constants.objectType: return mssql.ExtractTarget.objectType;
			case constants.schema: return mssql.ExtractTarget.schema;
			case constants.schemaObjectType: return mssql.ExtractTarget.schemaObjectType;
			default: throw new Error(constants.invalidInput(inputTarget));
		}
	} else {
		throw new Error(constants.extractTargetRequired);
	}
}

export interface DbServerValues {
	dbName?: string,
	dbVariable?: string,
	serverName?: string,
	serverVariable?: string
}

export function populateResultWithVars(referenceSettings: IUserDatabaseReferenceSettings, dbServerValues: DbServerValues) {
	if (dbServerValues.dbVariable) {
		referenceSettings.databaseName = ensureSetOrDefined(dbServerValues.dbName);
		referenceSettings.databaseVariable = ensureSetOrDefined(removeSqlCmdVariableFormatting(dbServerValues.dbVariable));
		referenceSettings.serverName = ensureSetOrDefined(dbServerValues.serverName);
		referenceSettings.serverVariable = ensureSetOrDefined(removeSqlCmdVariableFormatting(dbServerValues.serverVariable));
	} else {
		referenceSettings.databaseVariableLiteralValue = ensureSetOrDefined(dbServerValues.dbName);
	}
}

/**
 * Returns undefined for settings that are an empty string, meaning they are unset
 * @param setting
 */
export function ensureSetOrDefined(setting?: string): string | undefined {
	if (!setting || setting.trim().length === 0) {
		return undefined;
	}
	return setting;
}
