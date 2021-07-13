/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azExt from 'az-ext';
import { IAzTool } from './azdata';
import Logger from './common/logger';
import { NoAzureCLIError } from './common/utils';
import * as loc from './localizedConstants';
import { AzToolService } from './services/azToolService';

/**
 * Validates that :
 *	- Az is installed
 *	- The Az CLI has been accepted
 * @param az The az tool to check
 */
export function validateAz(az: IAzTool | undefined) {
	throwIfNoAz(az);
}

export function throwIfNoAz(localAz: IAzTool | undefined): asserts localAz {
	if (!localAz) {
		Logger.log(loc.noAzureCLI);
		throw new NoAzureCLIError();
	}
}

export function getExtensionApi(azToolService: AzToolService): azExt.IExtension {
	return {
		az: getAzApi(azToolService)
	};
}

export function getAzApi(azToolService: AzToolService): azExt.IAzApi {
	return {
		arcdata: {
			dc: {
				create: async (
					namespace: string,
					name: string,
					connectivityMode: string,
					resourceGroup: string,
					location: string,
					subscription: string,
					profileName?: string,
					storageClass?: string,
					additionalEnvVars?: azExt.AdditionalEnvVars) => {
					validateAz(azToolService.localAz);
					return azToolService.localAz!.arcdata.dc.create(namespace, name, connectivityMode, resourceGroup, location, subscription, profileName, storageClass, additionalEnvVars);
				},
				endpoint: {
					list: async (additionalEnvVars?: azExt.AdditionalEnvVars) => {
						validateAz(azToolService.localAz);
						return azToolService.localAz!.arcdata.dc.endpoint.list(additionalEnvVars);
					}
				},
				config: {
					list: async (additionalEnvVars?: azExt.AdditionalEnvVars) => {
						validateAz(azToolService.localAz);
						return azToolService.localAz!.arcdata.dc.config.list(additionalEnvVars);
					},
					show: async (additionalEnvVars?: azExt.AdditionalEnvVars) => {
						validateAz(azToolService.localAz);
						return azToolService.localAz!.arcdata.dc.config.show(additionalEnvVars);
					}
				}
			},
			postgres: {
				server: {
					delete: async (name: string, additionalEnvVars?: azExt.AdditionalEnvVars) => {
						validateAz(azToolService.localAz);
						return azToolService.localAz!.arcdata.postgres.server.delete(name, additionalEnvVars);
					},
					list: async (additionalEnvVars?: azExt.AdditionalEnvVars) => {
						validateAz(azToolService.localAz);
						return azToolService.localAz!.arcdata.postgres.server.list(additionalEnvVars);
					},
					show: async (name: string, additionalEnvVars?: azExt.AdditionalEnvVars) => {
						validateAz(azToolService.localAz);
						return azToolService.localAz!.arcdata.postgres.server.show(name, additionalEnvVars);
					},
					edit: async (
						name: string,
						args: {
							adminPassword?: boolean;
							coresLimit?: string;
							coresRequest?: string;
							coordinatorEngineSettings?: string;
							engineSettings?: string;
							extensions?: string;
							memoryLimit?: string;
							memoryRequest?: string;
							noWait?: boolean;
							port?: number;
							replaceEngineSettings?: boolean;
							workerEngineSettings?: string;
							workers?: number;
						},
						additionalEnvVars?: azExt.AdditionalEnvVars) => {
						validateAz(azToolService.localAz);
						return azToolService.localAz!.arcdata.postgres.server.edit(name, args, additionalEnvVars);
					}
				}
			},
			sql: {
				mi: {
					delete: async (name: string, additionalEnvVars?: azExt.AdditionalEnvVars) => {
						validateAz(azToolService.localAz);
						return azToolService.localAz!.arcdata.sql.mi.delete(name, additionalEnvVars);
					},
					list: async (additionalEnvVars?: azExt.AdditionalEnvVars) => {
						validateAz(azToolService.localAz);
						return azToolService.localAz!.arcdata.sql.mi.list(additionalEnvVars);
					},
					show: async (name: string, additionalEnvVars?: azExt.AdditionalEnvVars) => {
						validateAz(azToolService.localAz);
						return azToolService.localAz!.arcdata.sql.mi.show(name, additionalEnvVars);
					},
					edit: async (
						name: string,
						args: {
							coresLimit?: string;
							coresRequest?: string;
							memoryLimit?: string;
							memoryRequest?: string;
							noWait?: boolean;
						},
						additionalEnvVars?: azExt.AdditionalEnvVars
					) => {
						validateAz(azToolService.localAz);
						return azToolService.localAz!.arcdata.sql.mi.edit(name, args, additionalEnvVars);
					}
				}
			}
		},
		getPath: async () => {
			throwIfNoAz(azToolService.localAz);
			return azToolService.localAz.getPath();
		},
		getSemVersion: async () => {
			throwIfNoAz(azToolService.localAz);
			return azToolService.localAz.getSemVersion();
		},
		version: async () => {
			throwIfNoAz(azToolService.localAz);
			return azToolService.localAz.version();
		}
	};
}
