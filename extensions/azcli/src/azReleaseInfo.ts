/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as loc from './localizedConstants';
import { SemVer } from 'semver';
import { HttpClient } from './common/httpClient';
import Logger from './common/logger';
import { getErrorMessage } from './common/utils';
import { azHostname, azReleaseJson } from './constants';

interface PlatformReleaseInfo {
	version: string; // "20.0.1"
	link?: string; // "https://aka.ms/az-msi"
}

export interface AzReleaseInfo {
	win32: PlatformReleaseInfo,
	darwin: PlatformReleaseInfo,
	linux: PlatformReleaseInfo
}

function getPlatformAzReleaseInfo(releaseInfo: AzReleaseInfo): PlatformReleaseInfo {
	switch (os.platform()) {
		case 'win32':
			return releaseInfo.win32;
		case 'linux':
			return releaseInfo.linux;
		case 'darwin':
			return releaseInfo.darwin;
		default:
			Logger.log(loc.platformUnsupported(os.platform()));
			throw new Error(`Unsupported AzReleaseInfo platform '${os.platform()}`);
	}
}

/**
 * Gets the release version for the current platform from the release info - throwing an error if it doesn't exist.
 * @param releaseInfo The AzReleaseInfo object
 */
export async function getPlatformReleaseVersion(): Promise<SemVer> {
	const releaseInfo = await getAzReleaseInfo();
	const platformReleaseInfo = getPlatformAzReleaseInfo(releaseInfo);
	if (!platformReleaseInfo.version) {
		Logger.log(loc.noReleaseVersion(os.platform(), JSON.stringify(releaseInfo)));
		throw new Error(`No release version available for platform ${os.platform()}`);
	}
	Logger.log(loc.latestAzVersionAvailable(platformReleaseInfo.version));
	return new SemVer(platformReleaseInfo.version);
}

/**
 * Gets the download link for the current platform from the release info - throwing an error if it doesn't exist.
 * @param releaseInfo The AzReleaseInfo object
 */
export async function getPlatformDownloadLink(): Promise<string> {
	const releaseInfo = await getAzReleaseInfo();
	const platformReleaseInfo = getPlatformAzReleaseInfo(releaseInfo);
	if (!platformReleaseInfo.link) {
		Logger.log(loc.noDownloadLink(os.platform(), JSON.stringify(releaseInfo)));
		throw new Error(`No download link available for platform ${os.platform()}`);
	}
	return platformReleaseInfo.link;
}

async function getAzReleaseInfo(): Promise<AzReleaseInfo> {
	const fileContents = await HttpClient.getTextContent(`${azHostname}/${azReleaseJson}`);
	try {
		return JSON.parse(fileContents);
	} catch (e) {
		Logger.log(loc.failedToParseReleaseInfo(`${azHostname}/${azReleaseJson}`, fileContents, e));
		throw Error(`Failed to parse the JSON of contents at: ${azHostname}/${azReleaseJson}. Error: ${getErrorMessage(e)}`);
	}
}
