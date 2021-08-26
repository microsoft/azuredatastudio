/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { refineServiceDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IWindowConfiguration } from 'vs/platform/windows/common/windows';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import type { IWorkbenchConstructionOptions as IWorkbenchOptions } from 'vs/workbench/workbench.web.api';
import { URI } from 'vs/base/common/uri';

export const IWorkbenchEnvironmentService = refineServiceDecorator<IEnvironmentService, IWorkbenchEnvironmentService>(IEnvironmentService);

export interface IWorkbenchConfiguration extends IWindowConfiguration { }

/**
 * A workbench specific environment service that is only present in workbench
 * layer.
 */
export interface IWorkbenchEnvironmentService extends IEnvironmentService {

	// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
	// NOTE: KEEP THIS INTERFACE AS SMALL AS POSSIBLE. AS SUCH:
	//       PUT NON-WEB PROPERTIES INTO THE NATIVE WORKBENCH
	//       ENVIRONMENT SERVICE
	// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

	readonly options?: IWorkbenchOptions;

	readonly remoteAuthority?: string;

	readonly logFile: URI;

	readonly extHostLogsPath: URI;
	readonly logExtensionHostCommunication?: boolean;
	readonly extensionEnabledProposedApi?: string[];

	readonly webviewExternalEndpoint: string;

	readonly skipReleaseNotes: boolean;

	readonly debugRenderer: boolean;

	/**
	 * @deprecated this property will go away eventually as it
	 * duplicates many properties of the environment service
	 *
	 * Please consider using the environment service directly
	 * if you can.
	 */
	readonly configuration: IWorkbenchConfiguration;

	// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
	// NOTE: KEEP THIS INTERFACE AS SMALL AS POSSIBLE. AS SUCH:
	//       - PUT NON-WEB PROPERTIES INTO NATIVE WB ENV SERVICE
	// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
}
