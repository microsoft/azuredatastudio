/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';

/**
 * Simple fake Azdata Api used to mock the API during tests
 */
export class FakeAzdataApi implements azdataExt.IAzdataApi {

	private _arcApi = {
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
				postgresInstances: <azdataExt.PostgresServerListResult[]>[],
				delete(_name: string): Promise<azdataExt.AzdataOutput<void>> { throw new Error('Method not implemented.'); },
				async list(): Promise<azdataExt.AzdataOutput<azdataExt.PostgresServerListResult[]>> { return { result: this.postgresInstances, logs: [], stdout: [], stderr: [] }; },
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
				miaaInstances: <azdataExt.SqlMiListResult[]>[],
				delete(_name: string): Promise<azdataExt.AzdataOutput<void>> { throw new Error('Method not implemented.'); },
				async list(): Promise<azdataExt.AzdataOutput<azdataExt.SqlMiListResult[]>> { return { logs: [], stdout: [], stderr: [], result: this.miaaInstances }; },
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

	public set postgresInstances(instances: azdataExt.PostgresServerListResult[]) {
		this._arcApi.postgres.server.postgresInstances = instances;
	}

	public set miaaInstances(instances: azdataExt.SqlMiListResult[]) {
		this._arcApi.sql.mi.miaaInstances = instances;
	}

	//
	// API Implementation
	//
	public get arc() {
		return this._arcApi;
	}
	getPath(): Promise<string> {
		throw new Error('Method not implemented.');
	}
	login(_endpoint: string, _username: string, _password: string, _additionalEnvVars: azdataExt.AdditionalEnvVars = {}, _azdataContext?: string): Promise<azdataExt.AzdataOutput<void>> {
		return <any>undefined;
	}
	version(): Promise<azdataExt.AzdataOutput<string>> {
		throw new Error('Method not implemented.');
	}
	getSemVersion(): any {
		throw new Error('Method not implemented.');
	}

}
