/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { IPlatformService } from './platformService';

export interface DeploymentProfile {
	name: string;
	defaultDataSize: string;
	defaultLogSize: string;
	master: string;
	data: string;
	compute: string;
	hdfs: string;
	nameNode: string;
	spark: string;
	activeDirectory: boolean;
	hadr: string;
	includeSpark: string;
	gatewayPort: string;
	appProxyPort: string;
	sqlServerPort: string;
	readableSecondaryPort?: string;
	controllerPort: string;
	defaultDataStorageClass: string;
	defaultLogsStorageClass: string;
}

interface BdcConfigListOutput {
	stdout: string[];
}

export interface IAzdataService {
	getDeploymentProfiles(): Thenable<DeploymentProfile[]>;
}

export class AzdataService implements IAzdataService {
	constructor(private platformService: IPlatformService) {
	}

	getDeploymentProfiles(): Thenable<DeploymentProfile[]> {
		process.env['ACCEPT_EULA'] = 'Yes';
		return this.ensureWorkingDirectoryExists().then(() => {
			return this.getDeploymentProfileNames();
		}).then((names: string[]) => {
			const profilePromises: Thenable<DeploymentProfile>[] = [];
			names.forEach(name => {
				profilePromises.push(this.getDeploymentProfileInfo(name));
			});
			return Promise.all(profilePromises);
		});
	}

	private getDeploymentProfileNames(): Thenable<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			cp.exec('azdata bdc config list -o json', (error, stdout, stderror) => {
				if (error) {
					reject(error.message);
				} else {
					try {
						const output = <BdcConfigListOutput>JSON.parse(stdout);
						resolve(output.stdout);
					}
					catch (err) {
						if (err instanceof Error) {
							reject(err.message);
						} else {
							reject(err);
						}
					}
				}
			});
		});
	}

	private getDeploymentProfileInfo(profileName: string): Thenable<DeploymentProfile> {
		return new Promise<DeploymentProfile>((resolve, reject) => {
			cp.exec(`azdata bdc config init --source ${profileName} --target ${profileName} --force`, { cwd: this.platformService.storagePath() }, (error, stdout, stderror) => {
				if (error) {
					reject(error.message);
				} else {
					try {
						const bdcJson = this.getJsonObjectFromFile(path.join(this.platformService.storagePath(), profileName, 'bdc.json'));
						const controlJson = this.getJsonObjectFromFile(path.join(this.platformService.storagePath(), profileName, 'control.json'));
						resolve({
							name: profileName,
							defaultDataSize: (<string>controlJson.spec.storage.data.size).replace('Gi', ''),
							defaultLogSize: (<string>controlJson.spec.storage.logs.size).replace('Gi', ''),
							defaultDataStorageClass: (<string>controlJson.spec.storage.data.className),
							defaultLogsStorageClass: (<string>controlJson.spec.storage.logs.className),
							master: <string>bdcJson.spec.resources['master'].spec.replicas,
							data: <string>bdcJson.spec.resources['data-0'].spec.replicas,
							compute: <string>bdcJson.spec.resources['compute-0'].spec.replicas,
							hdfs: <string>bdcJson.spec.resources['storage-0'].spec.replicas,
							nameNode: <string>bdcJson.spec.resources['nmnode-0'].spec.replicas,
							spark: '0',
							activeDirectory: false, // TODO: implement AD check
							hadr: <string>bdcJson.spec.resources.master.spec.settings.sql['hadr.enabled'],
							includeSpark: <string>bdcJson.spec.resources['storage-0'].spec.settings.spark.includeSpark,
							gatewayPort: this.getEndpointPort(bdcJson.spec.resources.gateway.spec.endpoints, 'Knox'),
							appProxyPort: this.getEndpointPort(bdcJson.spec.resources.appproxy.spec.endpoints, 'AppServiceProxy'),
							sqlServerPort: this.getEndpointPort(bdcJson.spec.resources.master.spec.endpoints, 'Master'),
							readableSecondaryPort: this.getEndpointPort(bdcJson.spec.resources.master.spec.endpoints, 'MasterSecondary', '31436'),
							controllerPort: this.getEndpointPort(controlJson.spec.endpoints, 'Controller')
						});
					}
					catch (err) {
						if (err instanceof Error) {
							reject(err.message);
						} else {
							reject(err);
						}
					}
				}
			});
		});
	}

	private ensureWorkingDirectoryExists(): Thenable<void> {
		return new Promise<void>((resolve, reject) => {
			fs.access(this.platformService.storagePath(), (error) => {
				if (error && error.code === 'ENOENT') {
					fs.mkdir(this.platformService.storagePath(), (error) => {
						if (error) {
							reject(error.message);
						} else {
							resolve();
						}
					});
				} else {
					resolve();
				}
			});
		});
	}

	private getJsonObjectFromFile(path: string): any {
		return JSON.parse(fs.readFileSync(path, 'utf8'));
	}

	private getEndpointPort(endpoints: any, name: string, defaultValue: string = ''): string {
		const endpoint = (<{ port: string, name: string }[]>endpoints).find(endpoint => endpoint.name === name);
		return endpoint ? endpoint.port : defaultValue;
	}
}
