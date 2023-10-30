/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azExt from 'az-ext';
import { IAzTool } from './az';
import { NoAzureCLIError } from './common/utils';
import { AzToolService } from './services/azToolService';

/**
 * Validates that :
 *	- Az is installed
 * @param az The az tool to check
 */
export function validateAz(az: IAzTool | undefined) {
	throwIfNoAz(az);
}

export function throwIfNoAz(localAz: IAzTool | undefined): asserts localAz {
	if (!localAz) {
		throw new NoAzureCLIError();
	}
}

export function getExtensionApi(azToolService: AzToolService, localAzDiscovered: Promise<IAzTool | undefined>): azExt.IExtension {
	return {
		az: getAzApi(localAzDiscovered, azToolService)
	};
}

export function getAzApi(localAzDiscovered: Promise<IAzTool | undefined>, azToolService: AzToolService): azExt.IAzApi {
	return {
		arcdata: {
			dc: {
				endpoint: {
					list: async (namespace: string, additionalEnvVars?: azExt.AdditionalEnvVars) => {
						await localAzDiscovered;
						validateAz(azToolService.localAz);
						return azToolService.localAz!.arcdata.dc.endpoint.list(namespace, additionalEnvVars);
					}
				},
				config: {
					list: async (additionalEnvVars?: azExt.AdditionalEnvVars) => {
						await localAzDiscovered;
						validateAz(azToolService.localAz);
						return azToolService.localAz!.arcdata.dc.config.list(additionalEnvVars);
					},
					show: async (namespace: string, additionalEnvVars?: azExt.AdditionalEnvVars) => {
						await localAzDiscovered;
						validateAz(azToolService.localAz);
						return azToolService.localAz!.arcdata.dc.config.show(namespace, additionalEnvVars);
					}
				},
				listUpgrades: async (namespace: string, usek8s?: boolean, additionalEnvVars?: azExt.AdditionalEnvVars) => {
					await localAzDiscovered;
					validateAz(azToolService.localAz);
					return azToolService.localAz!.arcdata.dc.listUpgrades(namespace, usek8s, additionalEnvVars);
				},
				upgrade: async (
					desiredVersion: string,
					name: string,
					resourceGroup?: string,
					namespace?: string,
					additionalEnvVars?: azExt.AdditionalEnvVars
				) => {
					await localAzDiscovered;
					validateAz(azToolService.localAz);
					return azToolService.localAz!.arcdata.dc.upgrade(desiredVersion, name, resourceGroup, namespace, additionalEnvVars);
				}
			}
		},
		postgres: {
			serverarc: {
				delete: async (name: string, namespace: string, additionalEnvVars?: azExt.AdditionalEnvVars) => {
					await localAzDiscovered;
					validateAz(azToolService.localAz);
					return azToolService.localAz!.postgres.serverarc.delete(name, namespace, additionalEnvVars);
				},
				list: async (namespace: string, additionalEnvVars?: azExt.AdditionalEnvVars) => {
					await localAzDiscovered;
					validateAz(azToolService.localAz);
					return azToolService.localAz!.postgres.serverarc.list(namespace, additionalEnvVars);
				},
				show: async (name: string, namespace: string, additionalEnvVars?: azExt.AdditionalEnvVars) => {
					await localAzDiscovered;
					validateAz(azToolService.localAz);
					return azToolService.localAz!.postgres.serverarc.show(name, namespace, additionalEnvVars);
				},
				update: async (
					name: string,
					args: {
						coresLimit?: string;
						coresRequest?: string;
						memoryLimit?: string;
						memoryRequest?: string;
						noWait?: boolean;
						port?: number;
					},
					namespace: string,
					additionalEnvVars?: azExt.AdditionalEnvVars) => {
					await localAzDiscovered;
					validateAz(azToolService.localAz);
					return azToolService.localAz!.postgres.serverarc.update(name, args, namespace, additionalEnvVars);
				}
			}
		},
		sql: {
			miarc: {
				delete: async (
					name: string,
					args: {
						// ARM API arguments
						resourceGroup?: string;
						// K8s API arguments
						namespace?: string;
					},
					additionalEnvVars?: azExt.AdditionalEnvVars
				) => {
					await localAzDiscovered;
					validateAz(azToolService.localAz);
					return azToolService.localAz!.sql.miarc.delete(name, args, additionalEnvVars);
				},
				list: async (
					args: {
						// ARM API arguments
						resourceGroup?: string;
						// K8s API arguments
						namespace?: string;
					},
					additionalEnvVars?: azExt.AdditionalEnvVars
				) => {
					await localAzDiscovered;
					validateAz(azToolService.localAz);
					return azToolService.localAz!.sql.miarc.list(args, additionalEnvVars);
				},
				show: async (
					name: string,
					args: {
						// ARM API arguments
						resourceGroup?: string;
						// K8s API arguments
						namespace?: string;
					},
					// Additional arguments
					additionalEnvVars?: azExt.AdditionalEnvVars
				) => {
					await localAzDiscovered;
					validateAz(azToolService.localAz);
					return azToolService.localAz!.sql.miarc.show(name, args, additionalEnvVars);
				},
				update: async (
					name: string,
					args: {
						coresLimit?: string;
						coresRequest?: string;
						memoryLimit?: string;
						memoryRequest?: string;
						noWait?: boolean;
						syncSecondaryToCommit?: string;
					},
					// ARM API arguments
					resourceGroup?: string,
					// K8s API arguments
					namespace?: string,
					usek8s?: boolean,
					// Additional arguments
					additionalEnvVars?: azExt.AdditionalEnvVars
				) => {
					await localAzDiscovered;
					validateAz(azToolService.localAz);
					return azToolService.localAz!.sql.miarc.update(name, args, resourceGroup, namespace, usek8s, additionalEnvVars);
				},
				upgrade: async (
					name: string,
					args: {
						// ARM API arguments
						resourceGroup?: string;
						// K8s API arguments
						namespace?: string;
					},
					// Additional arguments
					additionalEnvVars?: azExt.AdditionalEnvVars
				) => {
					await localAzDiscovered;
					validateAz(azToolService.localAz);
					return azToolService.localAz!.sql.miarc.upgrade(name, args, additionalEnvVars);
				}
			},
			midbarc: {
				restore: async (name: string,
					args: {
						destName?: string,
						managedInstance?: string,
						time?: string,
						noWait?: boolean,
						dryRun?: boolean
					},
					namespace: string, additionalEnvVars?: azExt.AdditionalEnvVars) => {
					await localAzDiscovered;
					validateAz(azToolService.localAz);
					return azToolService.localAz!.sql.midbarc.restore(name, args, namespace, additionalEnvVars);
				}
			}
		},
		monitor: {
			logAnalytics: {
				workspace: {
					list: async (resourceGroup?: string, subscription?: string, additionalEnvVars?: azExt.AdditionalEnvVars) => {
						await localAzDiscovered;
						validateAz(azToolService.localAz);
						return azToolService.localAz!.monitor.logAnalytics.workspace.list(resourceGroup, subscription, additionalEnvVars);
					}
				}
			}
		},
		getPath: async () => {
			await localAzDiscovered;
			throwIfNoAz(azToolService.localAz);
			return azToolService.localAz.getPath();
		},
		getSemVersionAz: async () => {
			await localAzDiscovered;
			throwIfNoAz(azToolService.localAz);
			return azToolService.localAz.getSemVersionAz();
		},
		getSemVersionArc: async () => {
			await localAzDiscovered;
			throwIfNoAz(azToolService.localAz);
			return azToolService.localAz.getSemVersionArc();
		},
		version: async () => {
			await localAzDiscovered;
			throwIfNoAz(azToolService.localAz);
			return azToolService.localAz.version();
		}
	};
}
