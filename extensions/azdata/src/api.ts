/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import { IAzdataTool, isEulaAccepted, promptForEula } from './azdata';
import Logger from './common/logger';
import { NoAzdataError } from './common/utils';
import * as constants from './constants';
import * as loc from './localizedConstants';
import { AzdataToolService } from './services/azdataToolService';

function throwIfNoAzdataOrEulaNotAccepted(azdata: IAzdataTool | undefined, eulaAccepted: boolean): asserts azdata {
	throwIfNoAzdata(azdata);
	if (!eulaAccepted) {
		Logger.log(loc.eulaNotAccepted);
		throw new Error(loc.eulaNotAccepted);
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
					loginSession?: azdataExt.AzdataLoginSession) => {
					await localAzdataDiscovered;
					throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
					return azdataToolService.localAzdata.arc.dc.create(namespace, name, connectivityMode, resourceGroup, location, subscription, profileName, storageClass, additionalEnvVars, loginSession);
				},
				endpoint: {
					list: async (additionalEnvVars?: azdataExt.AdditionalEnvVars, loginSession?: azdataExt.AzdataLoginSession) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.dc.endpoint.list(additionalEnvVars, loginSession);
					}
				},
				config: {
					list: async (additionalEnvVars?: azdataExt.AdditionalEnvVars, loginSession?: azdataExt.AzdataLoginSession) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.dc.config.list(additionalEnvVars, loginSession);
					},
					show: async (additionalEnvVars?: azdataExt.AdditionalEnvVars, loginSession?: azdataExt.AzdataLoginSession) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.dc.config.show(additionalEnvVars, loginSession);
					}
				}
			},
			postgres: {
				server: {
					delete: async (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars, loginSession?: azdataExt.AzdataLoginSession) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.postgres.server.delete(name, additionalEnvVars, loginSession);
					},
					list: async (additionalEnvVars?: azdataExt.AdditionalEnvVars, loginSession?: azdataExt.AzdataLoginSession) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.postgres.server.list(additionalEnvVars, loginSession);
					},
					show: async (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars, loginSession?: azdataExt.AzdataLoginSession) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.postgres.server.show(name, additionalEnvVars, loginSession);
					},
					edit: async (
						name: string,
						args: {
							adminPassword?: boolean;
							coresLimit?: string;
							coresRequest?: string;
							engineSettings?: string;
							extensions?: string;
							memoryLimit?: string;
							memoryRequest?: string;
							noWait?: boolean;
							port?: number;
							replaceEngineSettings?: boolean;
							workers?: number;
						},
						engineVersion?: string,
						additionalEnvVars?: azdataExt.AdditionalEnvVars,
						loginSession?: azdataExt.AzdataLoginSession) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.postgres.server.edit(name, args, engineVersion, additionalEnvVars, loginSession);
					}
				}
			},
			sql: {
				mi: {
					delete: async (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars, loginSession?: azdataExt.AzdataLoginSession) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.sql.mi.delete(name, additionalEnvVars, loginSession);
					},
					list: async (additionalEnvVars?: azdataExt.AdditionalEnvVars, loginSession?: azdataExt.AzdataLoginSession) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.sql.mi.list(additionalEnvVars, loginSession);
					},
					show: async (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars, loginSession?: azdataExt.AzdataLoginSession) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.sql.mi.show(name, additionalEnvVars, loginSession);
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
						loginSession?: azdataExt.AzdataLoginSession
					) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.sql.mi.edit(name, args, additionalEnvVars, loginSession);
					}
				}
			}
		},
		getPath: async () => {
			await localAzdataDiscovered;
			throwIfNoAzdata(azdataToolService.localAzdata);
			return azdataToolService.localAzdata.getPath();
		},
		login: async (endpoint: string, username: string, password: string, additionalEnvVars?: azdataExt.AdditionalEnvVars) => {
			throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
			return azdataToolService.localAzdata.login(endpoint, username, password, additionalEnvVars);
		},
		acquireLoginSession: async (endpoint: string, username: string, password: string, additionEnvVars?: azdataExt.AdditionalEnvVars) => {
			throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
			return azdataToolService.localAzdata?.acquireLoginSession(endpoint, username, password, additionEnvVars);
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

