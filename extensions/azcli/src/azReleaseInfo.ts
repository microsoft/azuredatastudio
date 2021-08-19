/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

interface PlatformReleaseInfo {
	version: string; // "20.0.1"
	link?: string; // "https://aka.ms/az-msi"
}

export interface AzReleaseInfo {
	win32: PlatformReleaseInfo,
	darwin: PlatformReleaseInfo,
	linux: PlatformReleaseInfo
}
