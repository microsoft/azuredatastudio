/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'az-ext' {
	import { SemVer } from 'semver';

	/**
	 * Covers defining what the az extension exports to other extensions
	 *
	 * IMPORTANT: THIS IS NOT A HARD DEFINITION unlike vscode; therefore no enums or classes should be defined here
	 * (const enums get evaluated when typescript -> javascript so those are fine)
	 */
	export const enum extension {
		name = 'Microsoft.azcli'
	}

	export type AdditionalEnvVars = { [key: string]: string };

	export interface ErrorWithLink extends Error {
		messageWithLink: string;
	}

	export interface DcEndpointListResult {
		description: string, // "Management Proxy"
		endpoint: string, // "https://10.91.86.39:30777"
		name: string, // "mgmtproxy"
		protocol: string // "https"
	}

	export interface SqlMiListRawOutput {
		text: string,
		miaaList: SqlMiListResult[]
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
			annotations: {
				'management.azure.com/customLocation': string // "/subscriptions/a5082b19-8a6e-4bc5-8fdd-8ef39dfebc39/resourceGroups/canye-rg/providers/Microsoft.ExtendedLocation/customLocations/oakland"
			},
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

	export interface DcListUpgradesResult {
		versions: string[], // ["v1.4.1_2022-03-08", "v1.4.0_2022-02-25"]
		currentVersion: string, // "v1.4.1_2022-03-08"
		dates: string[] // ["03/08/2022", "02/25/2022"]
	}

	export interface StorageVolume {
		className?: string, // "local-storage"
		size: string // "5Gi"
	}

	export interface SchedulingOptions {
		memory?: string // "10Gi"
		cpu?: string // "4"
	}

	export interface ServiceSpec {
		type: string, // "NodePort"
		port?: number // 5432
	}

	export interface SqlMiShowResult {
		name: string, // "miaa-instance"
		spec: {
			backup?: {
				retentionPeriodInDays: number, // 1
			},
			readableSecondaries: string, // 0
            syncSecondaryToCommit: string, // -1,
			scheduling?: {
				default?: {
					resources?: {
						limits?: SchedulingOptions,
						requests?: SchedulingOptions
					}
				}
			},
			services: {
				primary: ServiceSpec
			},
			storage: {
				data: {
					volumes: StorageVolume[]
				},
				logs: {
					volumes: StorageVolume[]
				}
			}
		},
		status: {
			readyReplicas: string, // "1/1"
			state: string, // "Ready",
			logSearchDashboard: string, // https://127.0.0.1:30777/kibana/app/kibana#/discover?_a=(query:(language:kuery,query:'custom_resource_name:miaa1'))
			metricsDashboard: string, // https://127.0.0.1:30777/grafana/d/40q72HnGk/sql-managed-instance-metrics?var-hostname=miaa1-0
			primaryEndpoint?: string // "10.91.86.39:32718"
			runningVersion: string // "v1.5.0_2022-04-05"
		}
	}

	export interface SqlMiShowResultIndirect {
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
			backup?: {
				retentionPeriodInDays: number, // 1
			},
			readableSecondaries: string, // 0
			syncSecondaryToCommit: string, // -1
			scheduling?: {
				default?: {
					resources?: {
						limits?: SchedulingOptions,
						requests?: SchedulingOptions
					}
				}
			}
			services: {
				primary: ServiceSpec
			}
			storage: {
				data: {
					volumes: StorageVolume[]
				},
				logs: {
					volumes: StorageVolume[]
				}
			}
		},
		status: {
			readyReplicas: string, // "1/1"
			state: string, // "Ready",
			logSearchDashboard: string, // https://127.0.0.1:30777/kibana/app/kibana#/discover?_a=(query:(language:kuery,query:'custom_resource_name:miaa1'))
			metricsDashboard: string, // https://127.0.0.1:30777/grafana/d/40q72HnGk/sql-managed-instance-metrics?var-hostname=miaa1-0
			primaryEndpoint?: string // "10.91.86.39:32718"
			runningVersion: string // "v1.5.0_2022-04-05"
		}
	}

	export interface SqlMiShowResultDirect {
		extendedLocation: {
		  name: string, // /subscriptions/a2382b66-3h2k-3h2k-2gdd-8ef45dgfdc33/resourcegroups/name-rg/providers/microsoft.extendedlocation/customlocations/custom-loc,
		  type: string, // CustomLocation
		},
		id: string, // /subscriptions/a2382b66-3h2k-3h2k-2gdd-8ef45dgfdc33/resourceGroups/name-rg/providers/Microsoft.AzureArcData/sqlManagedInstances/sql1,
		location: string, // eastus2,
		name: string, // sql2,
		properties: {
		  activeDirectoryInformation: string, // null,
		  admin: string, // admin,
		  basicLoginInformation: string, // null,
		  clusterId: string, // null,
		  dataControllerId: string, // dc-name,
		  endTime: string, // null,
		  extensionId: string, // null,
		  k8SRaw: {
			spec: {
			  backup: {
				retentionPeriodInDays: number, // 7
			  },
			  dev: boolean, // true,
			  licenseType: string, // BasePrice,
			  metadata: {
				annotations: string, // ,
				labels: string, // ,
				namespace: string, // namespace-name
			  },
			  replicas: number, // 1,
			  readableSecondaries: string, // 0
              syncSecondaryToCommit: string, // -1,
			  scheduling: {
				additionalProperties: string, // null,
				default: {
				  additionalProperties: string, // null,
				  resources: {
					additionalProperties: string, // null,
					limits: {
					  cpu: string, // 4,
					  memory: string, // 8Gi
					},
					requests: {
					  cpu: string, // 2,
					  memory: string, // 4Gi
					}
				  }
				}
			  },
			  security: {
				adminLoginSecret: string, // sql-login-secret,
				serviceCertificateSecret: string, //
			  },
			  services: {
				primary: {
				  annotations: string, // ,
				  labels: string, // ,
				  type: string, // NodePort
				}
			  },
			  settings: {
				collation: string, // SQL_Latin1_General_CP1_CI_AS,
				language: {
				  lcid: number, // 1234
				},
				sqlagent: {
				  enabled: boolean, // false
				},
				timezone: string, // UTC,
				traceFlags: boolean, // false
			  },
			  storage: {
				backups: {
				  volumes: [
					{
					  annotations: string, // ,
					  className: string, // azurefile,
					  labels: string, // ,
					  size: string, // 5Gi
					}
				  ]
				},
				data: {
				  volumes: [
					{
					  annotations: string, // ,
					  className: string, // default,
					  labels: string, // ,
					  size: string, // 5Gi
					}
				  ]
				},
				datalogs: {
				  volumes: [
					{
					  annotations: string, // ,
					  className: string, // default,
					  labels: string, // ,
					  size: string, // 5Gi
					}
				  ]
				},
				logs: {
				  volumes: [
					{
					  annotations: string, // ,
					  className: string, // default,
					  labels: string, // ,
					  size: string, // 5Gi
					}
				  ]
				}
			  },
			  tier: string, // GeneralPurpose
			},
			status: {
			  endpoints: {
				logSearchDashboard: string, // https://localhost:12345/app/kibana#/discover?_a=(query:(language:kuery,query:'custom_resource_name:sql1')),
				metricsDashboard: string, // https://12.123.1.4:12345/d/sdfgwseg/sql-managed-instance-metrics?var-hostname=sql1-0,
				mirroring: string, // 10.224.0.4:32040,
				primary: string, // 10.224.0.4,32477
			  },
			  highAvailability: {
				lastUpdateTime: string, // 2022-05-09T23:40:19.626856Z,
				mirroringCertificate: string,
			  },
			  lastUpdateTime: string, // 2022-05-09T23:41:00.137919Z,
			  logSearchDashboard: string,
			  metricsDashboard: string,
			  observedGeneration: number, // 1,
			  primaryEndpoint: string, // 10.224.0.4,32477,
			  readyReplicas: string, // 1/1,
			  roles: {
				sql: {
				  lastUpdateTime: string, // 2022-05-09T23:39:53.364002Z,
				  readyReplicas: number, // 1,
				  replicas: number, // 1
				}
			  },
			  runningVersion: string, // v1.4.0_2022-02-25,
			  state: string, // Ready
			}
		  },
		  lastUploadedDate: string, // null,
		  licenseType: string, // BasePrice,
		  provisioningState: string, // Succeeded,
		  startTime: string, // null
		},
		resourceGroup: string, // rg-name,
		sku: {
		  capacity: string, // null,
		  dev: string, // null,
		  family: string, // null,
		  size: string, // null,
		  tier: string, // GeneralPurpose
		},
		tags: {},
		type: string, // microsoft.azurearcdata/sqlmanagedinstances
	  }

	export interface SqlMiDbRestoreResult {
		destDatabase: string, //testDbToRestore
		earliestRestoreTime: string, // "2020-08-19T20:25:11Z"
		latestRestoreTime: string,  //"2020-08-19T20:25:11Z"
		message: string, //Dry run for restore operation succeeded.
		observedGeneration: number, //1
		restorePoint: string, // "2020-08-19T20:25:11Z"
		sourceDatabase: string, //testDb
		state: string //Completed
	}

	export interface LogAnalyticsWorkspaceListResult {
		createdDate: string, // "2020-02-25T16:59:38Z"
		customerId: string, // "7e136a79-c0b6-4878-86bf-7bf7a6a7e6f6",
		eTag: string, // null,
		etag: string, // "\"00006df1-0000-0700-0000-61ee552f0000\"",
		features: {
			clusterResourceId: string, // null,
			disableLocalAuth: boolean, // null,
			enableDataExport: boolean, // null,
			enableLogAccessUsingOnlyResourcePermissions: boolean, //true,
			immediatePurgeDataOn30Days: boolean, // null,
			legacy: number, // 0,
			searchVersion: number // 1
		},
		forceCmkForQuery: boolean, // null,
		id: string, // "/subscriptions/a5082b19-8a6e-4bc5-8fdd-8ef39dfebc39/resourcegroups/bugbash/providers/microsoft.operationalinsights/workspaces/bugbash-logs",
		location: string, // "westus",
		modifiedDate: string, // "2022-02-21T09:18:22.3906451Z",
		name: string, // "bugbash-logs",
		privateLinkScopedResources: string, // null,
		provisioningState: string, // "Succeeded",
		publicNetworkAccessForIngestion: string, // "Enabled",
		publicNetworkAccessForQuery: string, // "Enabled",
		resourceGroup: string, // "bugbash",
		retentionInDays: number, // 30,
		sku: {
			capacityReservationLevel: number, // null,
			lastSkuUpdate: string, // "2020-02-25T16:59:38Z",
			name: string, // "pergb2018"
		},
		tags: string[], //null,
		type: string, //"Microsoft.OperationalInsights/workspaces",
		workspaceCapping: {
			dailyQuotaGb: number, //-1.0,
			dataIngestionStatus: string, // "RespectQuota",
			quotaNextResetTime: string, // "2022-02-21T19:00:00Z"
		}
	}

	export interface PostgresServerShowResult {
		apiVersion: string, // "arcdata.microsoft.com/v1alpha1"
		kind: string, // "postgresql"
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
					default: { [key: string]: string }, // { "max_connections": "101", "work_mem": "4MB" }
					roles: {
						coordinator: { [key: string]: string },
						worker: { [key: string]: string }
					}
				},
				version: string // "12"
			},
			scale: {
				shards: number, // 1 (shards was renamed to workers, kept here for backwards compatibility)
				workers: number // 1
			},
			scheduling: { // If no roles are specified, settings will apply to all nodes of the PostgreSQL Hyperscale server group.
				default: {
					resources: {
						requests: SchedulingOptions,
						limits: SchedulingOptions
					}
				},
				roles: {
					coordinator: {
						resources: {
							requests: SchedulingOptions,
							limits: SchedulingOptions
						}
					},
					worker: {
						resources: {
							requests: SchedulingOptions,
							limits: SchedulingOptions
						}
					}
				}
			},
			services: {
				primary: ServiceSpec
			},
			storage: {
				data: {
					volumes: StorageVolume[]
				},
				logs: {
					volumes: StorageVolume[]
				},
				backups: {
					volumes: StorageVolume[]
				}
			}
		},
		status: {
			primaryEndpoint: string, // "10.130.12.136:26630"
			readyPods: string, // "1/1",
			state: string, // "Ready"
			logSearchDashboard: string, // https://127.0.0.1:30777/kibana/app/kibana#/discover?_a=(query:(language:kuery,query:'custom_resource_name:pg1'))
			metricsDashboard: string, // https://127.0.0.1:30777/grafana/d/40q72HnGk/sql-managed-instance-metrics?var-hostname=pg1
			podsStatus: {
				conditions: {
					lastTransitionTime: string, // "2020-08-19T17:05:39Z"
					message?: string, // "containers with unready status: [fluentbit postgres telegraf]"
					reason?: string, // "ContainersNotReady"
					status: string, // "True"
					type: string // "Ready"
				}[],
				name: string, // "pg-instancew-0",
				role: string // "worker"
			}[]
		}
	}

	export interface AzOutput<R> {
		stdout: R,
		stderr: string[],
		code?: number
	}

	export interface EndpointOrNamespace {
		endpoint?: string,
		namespace?: string
	}
	export interface IAzApi {
		arcdata: {
			dc: {
				endpoint: {
					list(namespace?: string, additionalEnvVars?: AdditionalEnvVars): Promise<AzOutput<DcEndpointListResult[]>>
				},
				config: {
					list(additionalEnvVars?: AdditionalEnvVars): Promise<AzOutput<DcConfigListResult[]>>,
					show(namespace?: string, additionalEnvVars?: AdditionalEnvVars): Promise<AzOutput<DcConfigShowResult>>
				},
				listUpgrades(namespace: string, usek8s?: boolean, additionalEnvVars?: AdditionalEnvVars): Promise<AzOutput<DcListUpgradesResult>>,
				upgrade(desiredVersion: string, name: string, resourceGroup?: string, namespace?: string, additionalEnvVars?: AdditionalEnvVars): Promise<AzOutput<void>>,
			}
		},
		postgres: {
			arcserver: {
				delete(name: string, namespace?: string, additionalEnvVars?: AdditionalEnvVars): Promise<AzOutput<void>>,
				list(namespace?: string, additionalEnvVars?: AdditionalEnvVars): Promise<AzOutput<PostgresServerListResult[]>>,
				show(name: string, namespace?: string, additionalEnvVars?: AdditionalEnvVars): Promise<AzOutput<PostgresServerShowResult>>,
				edit(
					name: string,
					args: {
						adminPassword?: boolean,
						coresLimit?: string,
						coresRequest?: string,
						coordinatorEngineSettings?: string,
						engineSettings?: string,
						extensions?: string,
						memoryLimit?: string,
						memoryRequest?: string,
						noWait?: boolean,
						port?: number,
						replaceEngineSettings?: boolean,
						workerEngineSettings?: string,
						workers?: number
					},
					namespace?: string,
					additionalEnvVars?: AdditionalEnvVars
				): Promise<AzOutput<void>>
			}
		},
		sql: {
			miarc: {
				delete(
					name: string,
					args: {
						// ARM API arguments
						resourceGroup?: string,
						// K8s API arguments
						namespace?: string
						},
						// Additional arguments
						additionalEnvVars?: AdditionalEnvVars
				): Promise<AzOutput<void>>,
				list(
					args: {
					// ARM API arguments
					resourceGroup?: string,
					// K8s API arguments
					namespace?: string
					},
					// Additional arguments
					additionalEnvVars?: AdditionalEnvVars
				): Promise<AzOutput<SqlMiListRawOutput>>,
				show(
					name: string,
					args: {
						// ARM API arguments
						resourceGroup?: string,
						// K8s API arguments
						namespace?: string
					},
					// Additional arguments
					additionalEnvVars?: AdditionalEnvVars
				): Promise<AzOutput<SqlMiShowResult>>,
				update(
					name: string,
					args: {
						coresLimit?: string, //2
						coresRequest?: string, //1
						memoryLimit?: string, // 2Gi
						memoryRequest?: string, //1Gi
						noWait?: boolean, //true
						retentionDays?: string, //5
						syncSecondaryToCommit?: string //2
					},
					// ARM API arguments
					resourceGroup?: string,
					// K8s API arguments
					namespace?: string,
					usek8s?: boolean,
					// Additional arguments
					additionalEnvVars?: AdditionalEnvVars
				): Promise<AzOutput<void>>,
				upgrade(
					name: string,
					args: {
						// ARM API arguments
						resourceGroup?: string,
						// K8s API arguments
						namespace?: string
					},
					// Additional arguments
					additionalEnvVars?: AdditionalEnvVars
				): Promise<AzOutput<void>>
			},
			midbarc: {
				restore(
					name: string,
					args: {
						destName?: string, //testDb
						managedInstance?: string, //sqlmi1
						time?: string, //2021-10-12T11:16:30.000Z
						noWait?: boolean, //true
						dryRun?: boolean, //true
					},
					namespace?: string,
					additionalEnvVars?: AdditionalEnvVars
				): Promise<AzOutput<SqlMiDbRestoreResult>>
			}
		},
		monitor: {
			logAnalytics: {
				workspace: {
					list(
						resourceGroup?: string, // test-rg
						subscription?: string, // 122c121a-095a-4f5d-22e4-cc6b238490a3
						additionalEnvVars?: AdditionalEnvVars
					): Promise<AzOutput<LogAnalyticsWorkspaceListResult[]>>
				}
			}
		},
		getPath(): Promise<string>,
		/**
		 * The semVersion corresponding to this installation of the Azure CLI. version() method should have been run
		 * before fetching this value to ensure that correct value is returned. This is almost always correct unless
		 * Az has gotten reinstalled in the background after this IAzApi object was constructed.
		 */
		getSemVersionAz(): Promise<SemVer>,
		/**
		 * The semVersion corresponding to this installation of the Azure CLI arcdata extension. version() method should
		 * have been run before fetching this value to ensure that correct value is returned. This is almost always
		 * correct unless az arcdata has gotten reinstalled in the background after this IAzApi object was constructed.
		 */
		getSemVersionArc(): Promise<SemVer>,
		version(): Promise<AzOutput<string>>
	}

	export interface IExtension {
		az: IAzApi;
	}
}
