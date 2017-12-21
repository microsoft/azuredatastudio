/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { RequestType } from 'dataprotocol-client';
import { Runtime, LinuxDistribution } from '../platform';

// --------------------------------- < Version Request > -------------------------------------------------

// Version request message callback declaration
export namespace VersionRequest {
	export const type: RequestType<void, VersionResult, void> = { get method(): string { return 'version'; } };
}

// Version response format
export type VersionResult = string;

// ------------------------------- </ Version Request > --------------------------------------------------

// Constants interface for each extension
export interface IExtensionConstants {
	// TODO: Fill in interface

	// Definitely dependent on the extension
	extensionName: string;
	invalidServiceFilePath: string;
	serviceName: string;
	extensionConfigSectionName: string;
	serviceCompatibleVersion: string;
	outputChannelName: string;
	languageId: string;
	serviceInstallingTo: string;
	serviceInitializing: string;
	serviceInstalled: string;
	serviceLoadingFailed: string;
	serviceInstallationFailed: string;
	serviceInitializingOutputChannelName: string;
	commandsNotAvailableWhileInstallingTheService: string;
	providerId: string;
	serviceCrashMessage: string;
	serviceCrashLink: string;
	installFolderName: string;
	telemetryExtensionName: string;

	getRuntimeId(platform: string, architecture: string, distribution: LinuxDistribution): Runtime;

}

