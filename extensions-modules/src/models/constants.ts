/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export namespace Constants {
	//constants
	export const configLogDebugInfo: string = 'logDebugInfo';
	export const serviceNotCompatibleError: string = 'Client is not compatible with the service layer';
	export const serviceDownloading: string = 'Downloading';
	export const serviceInstalling: string = 'Installing';
	export const unsupportedPlatformErrorMessage: string = 'This platform is unsupported and application services may not function correctly';
	export const serviceConfigKey = 'service';
	export const executableFilesConfigKey = 'executableFiles';
	export const versionConfigKey = 'version';
	export const downloadUrlConfigKey = 'downloadUrl';
	export const installDirConfigKey = 'installDir';
	export const serviceCrashButton = 'View Known Issues';
	export const neverShowAgain = 'Do not show again';
	export const ignorePlatformWarning = 'ignorePlatformWarning';
	export const usingDefaultPlatformMessage = 'Unknown platform detected, defaulting to Linux_x64 platform';
	export const serverConnectionMetadata = 'serverConnectionMetadata';
	export const extensionDeactivated: string = 'de-activated.';
	export const extensionActivated: string = 'activated.';
}
