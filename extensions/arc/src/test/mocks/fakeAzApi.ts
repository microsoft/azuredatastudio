// /*---------------------------------------------------------------------------------------------
//  *  Copyright (c) Microsoft Corporation. All rights reserved.
//  *  Licensed under the Source EULA. See License.txt in the project root for license information.
//  *--------------------------------------------------------------------------------------------*/

// import * as azExt from 'az-ext';

// /**
//  * Simple fake Azdata Api used to mock the API during tests
//  */
// export class FakeAzApi implements azExt.IAzApi {

// 	private _arcApi = {
// 		dc: {
// 			create(_namespace: string, _name: string, _connectivityMode: string, _resourceGroup: string, _location: string, _subscription: string, _profileName?: string, _storageClass?: string): Promise<azExt.AzOutput<void>> { throw new Error('Method not implemented.'); },
// 			endpoint: {
// 				async list(): Promise<azExt.AzOutput<azExt.DcEndpointListResult[]>> { return <any>{ result: [] }; }
// 			},
// 			config: {
// 				list(): Promise<azExt.AzOutput<azExt.DcConfigListResult[]>> { throw new Error('Method not implemented.'); },
// 				async show(): Promise<azExt.AzOutput<azExt.DcConfigShowResult>> { return <any>{ result: undefined! }; }
// 			}
// 		},
// 		postgres: {
// 			server: {
// 				postgresInstances: <azExt.PostgresServerListResult[]>[],
// 				delete(_name: string): Promise<azExt.AzOutput<void>> { throw new Error('Method not implemented.'); },
// 				async list(): Promise<azExt.AzOutput<azExt.PostgresServerListResult[]>> { return { result: this.postgresInstances, logs: [], stdout: [], stderr: [] }; },
// 				show(_name: string): Promise<azExt.AzOutput<azExt.PostgresServerShowResult>> { throw new Error('Method not implemented.'); },
// 				edit(
// 					_name: string,
// 					_args: {
// 						adminPassword?: boolean,
// 						coresLimit?: string,
// 						coresRequest?: string,
// 						coordinatorEngineSettings?: string,
// 						engineSettings?: string,
// 						extensions?: string,
// 						memoryLimit?: string,
// 						memoryRequest?: string,
// 						noWait?: boolean,
// 						port?: number,
// 						replaceEngineSettings?: boolean,
// 						workerEngineSettings?: string,
// 						workers?: number
// 					},
// 					_additionalEnvVars?: azExt.AdditionalEnvVars
// 				): Promise<azExt.AzOutput<void>> { throw new Error('Method not implemented.'); }
// 			}
// 		},
// 		sql: {
// 			mi: {
// 				miaaInstances: <azExt.SqlMiListResult[]>[],
// 				delete(_name: string): Promise<azExt.AzOutput<void>> { throw new Error('Method not implemented.'); },
// 				async list(): Promise<azExt.AzOutput<azExt.SqlMiListResult[]>> { return { logs: [], stdout: [], stderr: [], result: this.miaaInstances }; },
// 				show(_name: string): Promise<azExt.AzOutput<azExt.SqlMiShowResult>> { throw new Error('Method not implemented.'); },
// 				edit(
// 					_name: string,
// 					_args: {
// 						coresLimit?: string,
// 						coresRequest?: string,
// 						memoryLimit?: string,
// 						memoryRequest?: string,
// 						noWait?: boolean
// 					}): Promise<azExt.AzOutput<void>> { throw new Error('Method not implemented.'); }
// 			}
// 		}
// 	};

// 	public set postgresInstances(instances: azExt.PostgresServerListResult[]) {
// 		this._arcApi.postgres.server.postgresInstances = instances;
// 	}

// 	public set miaaInstances(instances: azExt.SqlMiListResult[]) {
// 		this._arcApi.sql.mi.miaaInstances = instances;
// 	}

// 	//
// 	// API Implementation
// 	//
// 	public get arc() {
// 		return this._arcApi;
// 	}
// 	getPath(): Promise<string> {
// 		throw new Error('Method not implemented.');
// 	}
// 	login(_endpointOrNamespace: azExt.EndpointOrNamespace, _username: string, _password: string, _additionalEnvVars: azExt.AdditionalEnvVars = {}, _azdataContext?: string): Promise<azExt.AzOutput<void>> {
// 		return <any>undefined;
// 	}
// 	version(): Promise<azExt.AzOutput<string>> {
// 		throw new Error('Method not implemented.');
// 	}
// 	getSemVersion(): any {
// 		throw new Error('Method not implemented.');
// 	}

// }
