/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Covers defining what the azdata extension exports to other extensions
 *
 * IMPORTANT: THIS IS NOT A HARD DEFINITION unlike vscode; therefore no enums or classes should be defined here
 * (const enums get evaluated when typescript -> javascript so those are fine)
 */
export const enum extension {
	name = 'Microsoft.azdata'
}

export interface DcEndpointListResult {
	description: string,
	endpoint: string,
	name: string,
	protocol: string
}

export interface SqlMiListResult {
	name: string,
	replicas: string,
	serverEndpoint: string,
	state: string
}

export interface PostgresServerListResult {
	name: string,
	state: string,
	workers: number
}

export interface DcConfigShowResult {
	apiVersion: string,
	kind: string,
	metadata: {
		creationTimestamp: string,
		generation: number,
		name: string,
		namespace: string,
		resourceVersion: string,
		selfLink: string,
		uid: string
	},
	spec: {
		credentials: {
			controllerAdmin: string,
			dockerRegistry: string,
			serviceAccount: string
		},
		docker: {
			imagePullPolicy: string,
			imageTag: string,
			registry: string,
			repository: string
		},
		security: {
			allowDumps: string,
			allowNodeMetricsCollection: boolean,
			allowPodMetricsCollection: boolean,
			allowRunAsRoot: false
		},
		services: [
			{
				name: string,
				port: number,
				serviceType: string
			},
			{
				name: string,
				port: number,
				serviceType: string
			}
		],
		settings: {
			ElasticSearch: {
				'vm.max_map_count': string
			},
			controller: {
				enableBilling: string,
				'logs.rotation.days': string,
				'logs.rotation.size': string
			}
		},
		storage: {
			data: {
				accessMode: string,
				className: string,
				size: string
			},
			logs: {
				accessMode: string,
				className: string,
				size: string
			}
		}
	},
	status: {
		state: string
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
		state: string // "Ready"
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
		backups: {
			deltaMinutes: number, // 3,
			fullMinutes: number, // 10,
			tiers: [
				{
					retention: {
						maximums: string[], // [ "6", "512MB" ],
						minimums: string[], // [ "3" ]
					},
					storage: {
						volumeSize: string, // "1Gi"
					}
				}
			]
		},
		scale: {
			shards: number // 1
		},
		scheduling: {
			default: {
				resources: {
					requests: {
						memory: string, // "256Mi"
					}
				}
			}
		},
		storage: {
			data: {
				className: string, // "local-storage",
				size: string // "5Gi"
			},
			logs: {
				className: string, // "local-storage",
				size: string // "5Gi"
			}
		}
	},
	status: {
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

export interface IExtension {
	dc: {
		endpoint: {
			list(): Promise<AzdataOutput<DcEndpointListResult[]>>
		},
		config: {
			show(): Promise<AzdataOutput<DcConfigShowResult>>
		}
	},
	login(endpoint: string, username: string, password: string): Promise<AzdataOutput<any>>,
	postgres: {
		server: {
			list(): Promise<AzdataOutput<PostgresServerListResult[]>>,
			show(name: string): Promise<AzdataOutput<PostgresServerShowResult>>
		}
	},
	sql: {
		mi: {
			list(): Promise<AzdataOutput<SqlMiListResult[]>>,
			show(name: string): Promise<AzdataOutput<SqlMiShowResult>>
		}
	}
}
