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
				create: async (namespace: string, name: string, connectivityMode: string, resourceGroup: string, location: string, subscription: string, profileName?: string, storageClass?: string) => {
					await localAzdataDiscovered;
					throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
					return azdataToolService.localAzdata.arc.dc.create(namespace, name, connectivityMode, resourceGroup, location, subscription, profileName, storageClass);
				},
				endpoint: {
					list: async () => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.dc.endpoint.list();
					}
				},
				config: {
					list: async () => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.dc.config.list();
					},
					show: async () => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.dc.config.show();
					}
				}
			},
			postgres: {
				server: {
					delete: async (name: string) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.postgres.server.delete(name);
					},
					list: async () => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.postgres.server.list();
					},
					show: async (name: string) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.postgres.server.show(name);
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
						additionalEnvVars?: { [key: string]: string; }) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.postgres.server.edit(name, args, additionalEnvVars);
					}
				}
			},
			sql: {
				mi: {
					delete: async (name: string) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.sql.mi.delete(name);
					},
					list: async () => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.sql.mi.list();
					},
					show: async (name: string) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.sql.mi.show(name);
					},
					edit: async (
						name: string,
						args: {
							coresLimit?: string;
							coresRequest?: string;
							memoryLimit?: string;
							memoryRequest?: string;
							noWait?: boolean;
						}) => {
						await localAzdataDiscovered;
						throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
						return azdataToolService.localAzdata.arc.sql.mi.edit(name, args);
					}
				}
			}
		},
		getPath: async () => {
			await localAzdataDiscovered;
			throwIfNoAzdata(azdataToolService.localAzdata);
			return azdataToolService.localAzdata.getPath();
		},
		login: async (endpoint: string, username: string, password: string) => {
			throwIfNoAzdataOrEulaNotAccepted(azdataToolService.localAzdata, isEulaAccepted(memento));
			return azdataToolService.localAzdata.login(endpoint, username, password);
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

