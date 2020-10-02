/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import { IAzdataTool, promptForEula } from './azdata';
import Logger from './common/logger';
import { NoAzdataError } from './common/utils';
import * as constants from './constants';
import * as loc from './localizedConstants';


function throwIfNoAzdataOrEulaNotAccepted(azdata: IAzdataTool | undefined, eulaAccepted: boolean): void {
	throwIfNoAzdata(azdata);
	if (!eulaAccepted) {
		Logger.log(loc.eulaNotAccepted);
		throw new Error(loc.eulaNotAccepted);
	}
}

function throwIfNoAzdata(localAzdata: IAzdataTool | undefined) {
	if (!localAzdata) {
		Logger.log(loc.noAzdata);
		throw new NoAzdataError();
	}
}
export function getExtensionApi(context: vscode.ExtensionContext, localAzdata: IAzdataTool | undefined, eulaAccepted: boolean, localAzdataDiscovered: Promise<void>): azdataExt.IExtension {
	return {
		isEulaAccepted: () => !!context.globalState.get<boolean>(constants.eulaAccepted),
		promptForEula: (onError: boolean = true): Promise<boolean> => promptForEula(context.globalState, true /* userRequested */, onError),
		waitForAzdataToolDiscovery: () => localAzdataDiscovered,
		azdata: {
			arc: {
				dc: {
					create: async (namespace: string, name: string, connectivityMode: string, resourceGroup: string, location: string, subscription: string, profileName?: string, storageClass?: string) => {
						throwIfNoAzdataOrEulaNotAccepted(localAzdata, eulaAccepted);
						return localAzdata!.arc.dc.create(namespace, name, connectivityMode, resourceGroup, location, subscription, profileName, storageClass);
					},
					endpoint: {
						list: async () => {
							throwIfNoAzdataOrEulaNotAccepted(localAzdata, eulaAccepted);
							return localAzdata!.arc.dc.endpoint.list();
						}
					},
					config: {
						list: async () => {
							throwIfNoAzdataOrEulaNotAccepted(localAzdata, eulaAccepted);
							return localAzdata!.arc.dc.config.list();
						},
						show: async () => {
							throwIfNoAzdataOrEulaNotAccepted(localAzdata, eulaAccepted);
							return localAzdata!.arc.dc.config.show();
						}
					}
				},
				postgres: {
					server: {
						delete: async (name: string) => {
							throwIfNoAzdataOrEulaNotAccepted(localAzdata, eulaAccepted);
							return localAzdata!.arc.postgres.server.delete(name);
						},
						list: async () => {
							throwIfNoAzdataOrEulaNotAccepted(localAzdata, eulaAccepted);
							return localAzdata!.arc.postgres.server.list();
						},
						show: async (name: string) => {
							throwIfNoAzdataOrEulaNotAccepted(localAzdata, eulaAccepted);
							return localAzdata!.arc.postgres.server.show(name);
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
							throwIfNoAzdataOrEulaNotAccepted(localAzdata, eulaAccepted);
							return localAzdata!.arc.postgres.server.edit(name, args, additionalEnvVars);
						}
					}
				},
				sql: {
					mi: {
						delete: async (name: string) => {
							throwIfNoAzdataOrEulaNotAccepted(localAzdata, eulaAccepted);
							return localAzdata!.arc.sql.mi.delete(name);
						},
						list: async () => {
							throwIfNoAzdataOrEulaNotAccepted(localAzdata, eulaAccepted);
							return localAzdata!.arc.sql.mi.list();
						},
						show: async (name: string) => {
							throwIfNoAzdataOrEulaNotAccepted(localAzdata, eulaAccepted);
							return localAzdata!.arc.sql.mi.show(name);
						}
					}
				}
			},
			getPath: () => {
				throwIfNoAzdata(localAzdata);
				return localAzdata!.getPath();
			},
			login: async (endpoint: string, username: string, password: string) => {
				throwIfNoAzdataOrEulaNotAccepted(localAzdata, eulaAccepted);
				return localAzdata!.login(endpoint, username, password);
			},
			getSemVersion: () => {
				throwIfNoAzdata(localAzdata);
				return localAzdata!.getSemVersion();
			},
			version: async () => {
				throwIfNoAzdata(localAzdata);
				return localAzdata!.version();
			}
		}
	};
}


