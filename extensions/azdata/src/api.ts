/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import { IAzdataTool, isEulaAccepted, MIN_AZDATA_VERSION, promptForEula } from './azdata';
import Logger from './common/logger';
import { NoAzdataError } from './common/utils';
import * as constants from './constants';
import * as loc from './localizedConstants';
import { AzdataToolService } from './services/azdataToolService';

/**
 * Validates that :
 *	- Azdata is installed
 *	- The Azdata version is >= the minimum required version
 *	- The Azdata CLI has been accepted
 * @param azdata The azdata tool to check
 * @param eulaAccepted Whether the Azdata CLI EULA has been accepted
 */
async function validateAzdata(azdata: IAzdataTool | undefined, eulaAccepted: boolean): Promise<void> {
	throwIfNoAzdataOrEulaNotAccepted(azdata, eulaAccepted);
	await throwIfRequiredVersionMissing(azdata);
}

export function throwIfNoAzdataOrEulaNotAccepted(azdata: IAzdataTool | undefined, eulaAccepted: boolean): asserts azdata {
	throwIfNoAzdata(azdata);
	if (!eulaAccepted) {
		Logger.log(loc.eulaNotAccepted);
		throw new Error(loc.eulaNotAccepted);
	}
}

export async function throwIfRequiredVersionMissing(azdata: IAzdataTool): Promise<void> {
	const currentVersion = await azdata.getSemVersion();
	if (currentVersion.compare(MIN_AZDATA_VERSION) < 0) {
		throw new Error(loc.missingRequiredVersion(MIN_AZDATA_VERSION.raw));
	}
}

export function throwIfNoAzdata(localAzdata: IAzdataTool | undefined): asserts localAzdata {
	if (!localAzdata) {
		Logger.log(loc.noAzdata);
		throw new NoAzdataError();
	}
}

export function getExtensionApi(memento: vscode.Memento, azdataToolService: AzdataToolService, localAzdataDiscovered: Promise<IAzdataTool | undefined>): azdataExt.IExtension {
	return {
		isEulaAccepted: async () => {
			throwIfNoAzdata(await localAzdataDiscovered); // ensure that we have discovered Azdata
			return !!memento.get<boolean>(constants.eulaAccepted);
		},
		promptForEula: async (requireUserAction: boolean = true): Promise<boolean> => {
			await localAzdataDiscovered;
			return promptForEula(memento, true /* userRequested */, requireUserAction);
		},
		azdata: getAzdataApi(localAzdataDiscovered, azdataToolService, memento)
	};
}

export function getAzdataApi(localAzdataDiscovered: Promise<IAzdataTool | undefined>, azdataToolService: AzdataToolService, memento: vscode.Memento): azdataExt.IAzdataApi {
	return {
		arc: {
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
					additionalEnvVars?: azdataExt.AdditionalEnvVars,
					azdataContext?: string) => {
					await localAzdataDiscovered;
					await validateAzdata(azdataToolService.localAzdata, isEulaAccepted(memento));
					return azdataToolService.localAzdata!.arc.dc.create(namespace, name, connectivityMode, resourceGroup, location, subscription, profileName, storageClass, additionalEnvVars, azdataContext);
				},
				endpoint: {
					list: async (additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string) => {
						await localAzdataDiscovered;
						await validateAzdata(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata!.arc.dc.endpoint.list(additionalEnvVars, azdataContext);
					}
				},
				config: {
					list: async (additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string) => {
						await localAzdataDiscovered;
						await validateAzdata(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata!.arc.dc.config.list(additionalEnvVars, azdataContext);
					},
					show: async (additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string) => {
						await localAzdataDiscovered;
						await validateAzdata(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata!.arc.dc.config.show(additionalEnvVars, azdataContext);
					}
				}
			},
			postgres: {
				server: {
					delete: async (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string) => {
						await localAzdataDiscovered;
						await validateAzdata(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata!.arc.postgres.server.delete(name, additionalEnvVars, azdataContext);
					},
					list: async (additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string) => {
						await localAzdataDiscovered;
						await validateAzdata(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata!.arc.postgres.server.list(additionalEnvVars, azdataContext);
					},
					show: async (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string) => {
						await localAzdataDiscovered;
						await validateAzdata(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata!.arc.postgres.server.show(name, additionalEnvVars, azdataContext);
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
						additionalEnvVars?: azdataExt.AdditionalEnvVars,
						azdataContext?: string) => {
						await localAzdataDiscovered;
						await validateAzdata(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata!.arc.postgres.server.edit(name, args, additionalEnvVars, azdataContext);
					}
				}
			},
			sql: {
				mi: {
					delete: async (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string) => {
						await localAzdataDiscovered;
						await validateAzdata(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata!.arc.sql.mi.delete(name, additionalEnvVars, azdataContext);
					},
					list: async (additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string) => {
						await localAzdataDiscovered;
						await validateAzdata(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata!.arc.sql.mi.list(additionalEnvVars, azdataContext);
					},
					show: async (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string) => {
						await localAzdataDiscovered;
						await validateAzdata(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata!.arc.sql.mi.show(name, additionalEnvVars, azdataContext);
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
						additionalEnvVars?: azdataExt.AdditionalEnvVars,
						azdataContext?: string
					) => {
						await localAzdataDiscovered;
						await validateAzdata(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata!.arc.sql.mi.edit(name, args, additionalEnvVars, azdataContext);
					}
				}
			}
		},
		getPath: async () => {
			await localAzdataDiscovered;
			throwIfNoAzdata(azdataToolService.localAzdata);
			return azdataToolService.localAzdata.getPath();
		},
		login: async (endpointOrNamespace: azdataExt.EndpointOrNamespace, username: string, password: string, additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string) => {
			await validateAzdata(azdataToolService.localAzdata, isEulaAccepted(memento));
			return azdataToolService.localAzdata!.login(endpointOrNamespace, username, password, additionalEnvVars, azdataContext);
		},
		getSemVersion: async () => {
			await localAzdataDiscovered;
			throwIfNoAzdata(azdataToolService.localAzdata);
			return azdataToolService.localAzdata.getSemVersion();
		},
		version: async () => {
			await localAzdataDiscovered;
			throwIfNoAzdata(azdataToolService.localAzdata);
			return azdataToolService.localAzdata.version();
		}
	};
}

