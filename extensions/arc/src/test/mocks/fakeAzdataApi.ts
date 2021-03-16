/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';

/**
 * Simple fake Azdata Api used to mock the API during tests
 */
export class FakeAzdataApi implements azdataExt.IAzdataApi {

	public postgresInstances: azdataExt.PostgresServerListResult[] = [];
	public miaaInstances: azdataExt.SqlMiListResult[] = [];

	//
	// API Implementation
	//
	public get arc() {
		const self = this;
		return {
			dc: {
				create(_namespace: string, _name: string, _connectivityMode: string, _resourceGroup: string, _location: string, _subscription: string, _profileName?: string, _storageClass?: string): Promise<azdataExt.AzdataOutput<void>> { throw new Error('Method not implemented.'); },
				endpoint: {
					async list(): Promise<azdataExt.AzdataOutput<azdataExt.DcEndpointListResult[]>> { return <any>{ result: [] }; }
				},
				config: {
					list(): Promise<azdataExt.AzdataOutput<azdataExt.DcConfigListResult[]>> { throw new Error('Method not implemented.'); },
					async show(): Promise<azdataExt.AzdataOutput<azdataExt.DcConfigShowResult>> { return <any>{ result: undefined! }; }
				}
			},
			postgres: {
				server: {
					delete(_name: string): Promise<azdataExt.AzdataOutput<void>> { throw new Error('Method not implemented.'); },
					async list(): Promise<azdataExt.AzdataOutput<azdataExt.PostgresServerListResult[]>> { return <any>{ result: self.postgresInstances }; },
					show(_name: string): Promise<azdataExt.AzdataOutput<azdataExt.PostgresServerShowResult>> { throw new Error('Method not implemented.'); },
					edit(
						_name: string,
						_args: {
							adminPassword?: boolean,
							coresLimit?: string,
							coresRequest?: string,
							engineSettings?: string,
							extensions?: string,
							memoryLimit?: string,
							memoryRequest?: string,
							noWait?: boolean,
							port?: number,
							replaceEngineSettings?: boolean,
							workers?: number
						},
						_additionalEnvVars?: azdataExt.AdditionalEnvVars
					): Promise<azdataExt.AzdataOutput<void>> { throw new Error('Method not implemented.'); }
				}
			},
			sql: {
				mi: {
					delete(_name: string): Promise<azdataExt.AzdataOutput<void>> { throw new Error('Method not implemented.'); },
					async list(): Promise<azdataExt.AzdataOutput<azdataExt.SqlMiListResult[]>> { return <any>{ result: self.miaaInstances }; },
					show(_name: string): Promise<azdataExt.AzdataOutput<azdataExt.SqlMiShowResult>> { throw new Error('Method not implemented.'); },
					edit(
						_name: string,
						_args: {
							coresLimit?: string,
							coresRequest?: string,
							memoryLimit?: string,
							memoryRequest?: string,
							noWait?: boolean
						}): Promise<azdataExt.AzdataOutput<void>> { throw new Error('Method not implemented.'); }
				}
			}
		};
	}
	getPath(): Promise<string> {
		throw new Error('Method not implemented.');
	}
	login(_endpoint: string, _username: string, _password: string): Promise<azdataExt.AzdataOutput<void>> {
		return <any>undefined;
	}
	acquireSession(_endpoint: string, _username: string, _password: string): Promise<azdataExt.AzdataSession> {
		return Promise.resolve({ dispose: () => { } });
	}
	version(): Promise<azdataExt.AzdataOutput<string>> {
		throw new Error('Method not implemented.');
	}
	getSemVersion(): any {
		throw new Error('Method not implemented.');
	}

}
