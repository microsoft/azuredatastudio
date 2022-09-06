/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlTargetPlatform } from 'sqldbproj';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import { HttpClient } from '../common/httpClient';
import { AgreementInfo, DockerImageInfo } from '../models/deploy/deployProfile';

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
 * Returns the docker image place holder based on the target version
 */
export function getDockerImagePlaceHolder(target: string): string {
	return target === constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlAzure) ?
		constants.dockerImagesPlaceHolder(constants.AzureSqlDbLiteDockerImageName) :
		constants.dockerImagesPlaceHolder(SqlTargetPlatform.sqlEdge);
}

/**
 * Returns the list of image tags for given target
 * @param imageInfo docker image info
 * @param target project target version
 * @returns image tags
 */
export async function getImageTags(imageInfo: DockerImageInfo, target: string): Promise<string[]> {
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
		}
	} catch (err) {
		// Ignore the error. If http request fails, we just use the default tag
		console.debug(`Failed to get docker image tags ${err}`);
	}

	return imageTags;
}

/**
 * Returns the list of base images for given target version
 * @param target
 * @returns list of image info
 */
export function getDockerBaseImages(target: string): DockerImageInfo[] {
	if (target === constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlAzure)) {
		return [{
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
		}, {
			name: `${constants.sqlServerDockerRegistry}/${constants.azureSqlEdgeDockerRepository}`,
			displayName: constants.AzureSqlDbLiteDockerImageName,
			agreementInfo: {
				link: {
					text: constants.edgeEulaAgreementTitle,
					url: constants.sqlServerEdgeEulaLink,
				}
			},
			tagsUrl: `https://${constants.sqlServerDockerRegistry}/v2/${constants.azureSqlEdgeDockerRepository}/tags/list`,
			defaultTag: constants.dockerImageDefaultTag
		}];
	} else {
		return [
			{
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
			},
			{
				name: `${constants.sqlServerDockerRegistry}/${constants.azureSqlEdgeDockerRepository}`,
				displayName: SqlTargetPlatform.sqlEdge,
				agreementInfo: {
					link: {
						text: constants.edgeEulaAgreementTitle,
						url: constants.sqlServerEdgeEulaLink,
					}
				},
				tagsUrl: `https://${constants.sqlServerDockerRegistry}/v2/${constants.azureSqlEdgeDockerRepository}/tags/list`,
				defaultTag: constants.dockerImageDefaultTag
			},
		];
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
