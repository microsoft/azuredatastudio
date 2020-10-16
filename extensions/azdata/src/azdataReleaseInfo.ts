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
import { azdataHostname, azdataReleaseJson } from './constants';

interface PlatformReleaseInfo {
	version: string; // "20.0.1"
	link?: string; // "https://aka.ms/azdata-msi"
}

export interface AzdataReleaseInfo {
	win32: PlatformReleaseInfo,
	darwin: PlatformReleaseInfo,
	linux: PlatformReleaseInfo
}

function getPlatformAzdataReleaseInfo(releaseInfo: AzdataReleaseInfo): PlatformReleaseInfo {
	switch (os.platform()) {
		case 'win32':
			return releaseInfo.win32;
		case 'linux':
			return releaseInfo.linux;
		case 'darwin':
			return releaseInfo.darwin;
		default:
			Logger.log(loc.platformUnsupported(os.platform()));
			throw new Error(`Unsupported AzdataReleaseInfo platform '${os.platform()}`);
	}
}

/**
 * Gets the release version for the current platform from the release info - throwing an error if it doesn't exist.
 * @param releaseInfo The AzdataReleaseInfo object
 */
export async function getPlatformReleaseVersion(): Promise<SemVer> {
	const releaseInfo = await getAzdataReleaseInfo();
	const platformReleaseInfo = getPlatformAzdataReleaseInfo(releaseInfo);
	if (!platformReleaseInfo.version) {
		Logger.log(loc.noReleaseVersion(os.platform(), JSON.stringify(releaseInfo)));
		throw new Error(`No release version available for platform ${os.platform()}`);
	}
	Logger.log(loc.latestAzdataVersionAvailable(platformReleaseInfo.version));
	return new SemVer(platformReleaseInfo.version);
}

/**
 * Gets the download link for the current platform from the release info - throwing an error if it doesn't exist.
 * @param releaseInfo The AzdataReleaseInfo object
 */
export async function getPlatformDownloadLink(): Promise<string> {
	const releaseInfo = await getAzdataReleaseInfo();
	const platformReleaseInfo = getPlatformAzdataReleaseInfo(releaseInfo);
	if (!platformReleaseInfo.link) {
		Logger.log(loc.noDownloadLink(os.platform(), JSON.stringify(releaseInfo)));
		throw new Error(`No download link available for platform ${os.platform()}`);
	}
	return platformReleaseInfo.link;
}

async function getAzdataReleaseInfo(): Promise<AzdataReleaseInfo> {
	const fileContents = await HttpClient.getTextContent(`${azdataHostname}/${azdataReleaseJson}`);
	try {
		return JSON.parse(fileContents);
	} catch (e) {
		Logger.log(loc.failedToParseReleaseInfo(`${azdataHostname}/${azdataReleaseJson}`, fileContents, e));
		throw Error(`Failed to parse the JSON of contents at: ${azdataHostname}/${azdataReleaseJson}. Error: ${getErrorMessage(e)}`);
	}
}
