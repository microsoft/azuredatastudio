/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { IPlatformService } from './platformService';
import { BigDataClusterDeploymentProfile } from './bigDataClusterDeploymentProfile';

interface BdcConfigListOutput {
	stdout: string[];
}

export interface IAzdataService {
	getDeploymentProfiles(): Thenable<BigDataClusterDeploymentProfile[]>;
}

export class AzdataService implements IAzdataService {
	constructor(private platformService: IPlatformService) {
	}

	getDeploymentProfiles(): Thenable<BigDataClusterDeploymentProfile[]> {
		process.env['ACCEPT_EULA'] = 'Yes';
		return this.ensureWorkingDirectoryExists().then(() => {
			return this.getDeploymentProfileNames();
		}).then((names: string[]) => {
			const profilePromises: Thenable<BigDataClusterDeploymentProfile>[] = [];
			names.forEach(name => {
				profilePromises.push(this.getDeploymentProfileInfo(name));
			});
			return Promise.all(profilePromises);
		});
	}

	private getDeploymentProfileNames(): Promise<string[]> {
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

	private getDeploymentProfileInfo(profileName: string): Promise<BigDataClusterDeploymentProfile> {
		return new Promise<BigDataClusterDeploymentProfile>((resolve, reject) => {
			cp.exec(`azdata bdc config init --source ${profileName} --target ${profileName} --force`, { cwd: this.platformService.storagePath() }, (error, stdout, stderror) => {
				if (error) {
					reject(error.message);
				} else {
					const bdcJsonPromise = this.getJsonObjectFromFile(path.join(this.platformService.storagePath(), profileName, 'bdc.json'));
					const controlJsonPromise = this.getJsonObjectFromFile(path.join(this.platformService.storagePath(), profileName, 'control.json'));
					Promise.all([bdcJsonPromise, controlJsonPromise]).then((value) => {
						resolve(new BigDataClusterDeploymentProfile(profileName, value[0], value[1]));
					}).catch((error: Error) => {
						reject(error.message);
					});
				}
			});
		});
	}

	private ensureWorkingDirectoryExists(): Promise<void> {
		return fs.promises.access(this.platformService.storagePath()).catch(error => {
			if (error && error.code === 'ENOENT') {
				return fs.promises.mkdir(this.platformService.storagePath());
			}
			else {
				throw error;
			}
		});
	}

	private getJsonObjectFromFile(path: string): Promise<any> {
		return fs.promises.readFile(path, 'utf8').then(result => { return JSON.parse(result); });
	}
}
