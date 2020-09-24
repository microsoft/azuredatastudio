/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'azdata-ext' {
	import { SemVer } from 'semver';

	/**
	 * Covers defining what the azdata extension exports to other extensions
	 *
	 * IMPORTANT: THIS IS NOT A HARD DEFINITION unlike vscode; therefore no enums or classes should be defined here
	 * (const enums get evaluated when typescript -> javascript so those are fine)
	 */
	export const enum extension {
		name = 'Microsoft.azdata'
	}

	export interface ErrorWithLink extends Error {
		messageWithLink: string;
	}

	export interface DcEndpointListResult {
		description: string, // "Management Proxy"
		endpoint: string, // "https://10.91.86.39:30777"
		name: string, // "mgmtproxy"
		protocol: string // "https"
	}

	export interface SqlMiListResult {
		name: string, // "arc-miaa"
		replicas: string, // "1/1"
		serverEndpoint: string,
		state: string // "Ready"
	}

	export interface PostgresServerListResult {
		name: string, // "arc-pg"
		state: string, // "Ready"
		workers: number // 1
	}

	export type DcConfigListResult = string;

	export interface DcConfigShowResult {
		apiVersion: string, // "arcdata.microsoft.com/v1alpha1"
		kind: string, // "DataController"
		metadata: {
			creationTimestamp: string, // "2020-08-19T17:05:39Z"
			generation: number, // /1
			name: string, // "arc"
			namespace: string, // "arc"
			resourceVersion: string, // "200369"
			selfLink: string, // "/apis/arcdata.microsoft.com/v1alpha1/namespaces/arc/datacontrollers/arc"
			uid: string// "da72ed34-ee51-4bf0-b5c9-b0753834c5c1"
		},
		spec: {
			credentials: {
				controllerAdmin: string, // "controller-login-secret"
				dockerRegistry: string, // "mssql-private-registry"
				serviceAccount: string, // "sa-mssql-controller"
			},
			docker: {
				imagePullPolicy: string, // "Always"
				imageTag: string, // "15.0.2000.41811_5"
				registry: string, // "hlsaris.azurecr.io"
				repository: string // "aris-p-master-dsmain-standard"
			},
			security: {
				allowDumps: boolean, // true,
				allowNodeMetricsCollection: boolean // true
				allowPodMetricsCollection: boolean, // true
				allowRunAsRoot: boolean // false
			},
			services: {
				name: string, // "controller"
				port: number, // 30080
				serviceType: string // "NodePort"
			}[],
			settings: {
				ElasticSearch: {
					'vm.max_map_count': string // "-1"
				},
				azure: {
					connectionMode: string, // "indirect",
					location: string, // "eastus2euap",
					resourceGroup: string, // "my-rg",
					subscription: string, // "a5082b29-8c6e-4bc5-8ddd-8ef39dfebc39"
				},
				controller: {
					'enableBilling': string, // "True"
					'logs.rotation.days': string, // "7"
					'logs.rotation.size': string, // "5000"
				}
			},
			storage: {
				data: {
					accessMode: string, // "ReadWriteOnce"
					className: string, // "local-storage"
					size: string, // "15Gi"
				},
				logs: {
					accessMode: string, // "ReadWriteOnce"
					className: string, // "local-storage"
					size: string, // "10Gi"
				}
			}
		},
		status: {
			state: string, // "Ready"
		}
	}

	export interface SqlMiShowResult {
		apiVersion: string, // "sql.arcdata.microsoft.com/v1alpha1"
		kind: string, // "sqlmanagedinstance"
		metadata: {
			creationTimestamp: string, // "2020-08-19T17:35:45Z"
			generation: number, // 1
			name: string, // "miaa-instance"
			namespace: string, // "arc"
			resourceVersion: string, // "202623"
			selfLink: string, // "/apis/sql.arcdata.microsoft.com/v1alpha1/namespaces/arc/sqlmanagedinstances/miaa-instance"
			uid: string // "cea737aa-3f82-4f6a-9bed-2b51c2c33dff"
		},
		spec: {
			limits?: {
				vcores?: number // 4
			}
			service: {
				type: string // "NodePort"
			}
			storage: {
				data: {
					className: string, // "local-storage"
					size: string // "5Gi"
				},
				logs: {
					className: string, // "local-storage"
					size: string // "5Gi"
				}
			}
		},
		status: {
			readyReplicas: string, // "1/1"
			state: string, // "Ready"
			externalEndpoint?: string // "10.91.86.39:32718"
		}
	}

	export interface PostgresServerShowResult {
		apiVersion: string, // "arcdata.microsoft.com/v1alpha1"
		kind: string, // "postgresql-12"
		metadata: {
			creationTimestamp: string, // "2020-08-19T20:25:11Z"
			generation: number, // 1
			name: string, // "chgagnon-pg"
			namespace: string, // "arc",
			resourceVersion: string, // "214944",
			selfLink: string, // "/apis/arcdata.microsoft.com/v1alpha1/namespaces/arc/postgresql-12s/chgagnon-pg",
			uid: string, // "26d0f5bb-0c0b-4225-a6b5-5be2bf6feac0"
		},
		spec: {
			engine: {
				extensions: {
					name: string // "citus"
				}[],
				settings: {
					default: { [key: string]: string } // { "max_connections": "101", "work_mem": "4MB" }
				}
			},
			scale: {
				shards: number // 1
			},
			scheduling: {
				default: {
					resources: {
						requests: {
							cpu: string, // "1.5"
							memory: string // "256Mi"
						},
						limits: {
							cpu: string, // "1.5"
							memory: string // "256Mi"
						}
					}
				}
			},
			service: {
				type: string, // "NodePort"
				port: number // 5432
			},
			storage: {
				data: {
					className: string, // "local-storage"
					size: string // "5Gi"
				},
				logs: {
					className: string, // "local-storage"
					size: string // "5Gi"
				},
				backups: {
					className: string, // "local-storage"
					size: string // "5Gi"
				}
			}
		},
		status: {
			externalEndpoint: string, // "10.130.12.136:26630"
			readyPods: string, // "1/1",
			state: string // "Ready"
		}
	}

	export interface AzdataOutput<R> {
		logs: string[],
		result: R,
		stderr: string[],
		stdout: string[],
		code?: number
	}

	export interface IAzdataApi {
		arc: {
			dc: {
				create(namespace: string, name: string, connectivityMode: string, resourceGroup: string, location: string, subscription: string, profileName?: string, storageClass?: string): Promise<AzdataOutput<void>>,
				endpoint: {
					list(): Promise<AzdataOutput<DcEndpointListResult[]>>
				},
				config: {
					list(): Promise<AzdataOutput<DcConfigListResult[]>>,
					show(): Promise<AzdataOutput<DcConfigShowResult>>
				}
			},
			postgres: {
				server: {
					delete(name: string): Promise<AzdataOutput<void>>,
					list(): Promise<AzdataOutput<PostgresServerListResult[]>>,
					show(name: string): Promise<AzdataOutput<PostgresServerShowResult>>,
					edit(
						name: string,
						args: {
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
						additionalEnvVars?: { [key: string]: string }): Promise<AzdataOutput<void>>
				}
			},
			sql: {
				mi: {
					delete(name: string): Promise<AzdataOutput<void>>,
					list(): Promise<AzdataOutput<SqlMiListResult[]>>,
					show(name: string): Promise<AzdataOutput<SqlMiShowResult>>
				}
			}
		},
		getPath(): string,
		login(endpoint: string, username: string, password: string): Promise<AzdataOutput<any>>,
		/**
		 * The semVersion corresponding to this installation of azdata. version() method should have been run
		 * before fetching this value to ensure that correct value is returned. This is almost always correct unless
		 * Azdata has gotten reinstalled in the background after this IAzdataApi object was constructed.
		 */
		getSemVersion(): SemVer,
		version(): Promise<AzdataOutput<string>>
	}

	export interface IExtension {
		azdata: IAzdataApi;

		/**
		 * returns true if AZDATA CLI EULA has been previously accepted by the user.
		 */
		isEulaAccepted(): boolean;

		/**
		 * Prompts user to accept EULA. Stores and returns the user response to EULA prompt.
		 * @param requireUserAction - if the prompt is required to be acted upon by the user. This is typically 'true' when this method is called to address an Error when the EULA needs to be accepted to proceed.
		 *
		 * pre-requisite, the calling code has to ensure that the EULA has not yet been previously accepted by the user. The code can use @see isEulaAccepted() call to ascertain this.
		 * returns true if the user accepted the EULA.
		 */
		promptForEula(requireUserAction?: boolean): Promise<boolean>
	}
}
