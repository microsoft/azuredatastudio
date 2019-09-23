/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
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
		return this.ensureWorkingDirectoryExists().then(() => {
			return this.getDeploymentProfileNames();
		}).then((names: string[]) => {
			return Promise.all(names.map(name => { return this.getDeploymentProfileInfo(name); }));
		});
	}

	private async getDeploymentProfileNames(): Promise<string[]> {
		process.env['ACCEPT_EULA'] = 'yes';
		const cmd = 'azdata bdc config list -o json';
		// Run the command twice to workaround the issue:
		// First time use of the azdata will have extra EULA related string in the output
		// there is not easy and reliable way to filter out the profile names from it.
		await this.platformService.runCommand(cmd);
		return this.platformService.runCommand(cmd).then(stdout => {
			const output = <BdcConfigListOutput>JSON.parse(stdout);
			return output.stdout;
		});
	}

	private getDeploymentProfileInfo(profileName: string): Promise<BigDataClusterDeploymentProfile> {
		return this.platformService.runCommand(`azdata bdc config init --source ${profileName} --target ${profileName} --force`, this.platformService.storagePath()).then(stdout => {
			return Promise.all([
				this.getJsonObjectFromFile(path.join(this.platformService.storagePath(), profileName, 'bdc.json')),
				this.getJsonObjectFromFile(path.join(this.platformService.storagePath(), profileName, 'control.json'))
			]);
		}).then((configObjects) => {
			return new BigDataClusterDeploymentProfile(profileName, configObjects[0], configObjects[1]);
		});
	}

	private ensureWorkingDirectoryExists(): Promise<void> {
		return this.platformService.fileExists(this.platformService.storagePath()).then(exists => {
			if (!exists) {
				return this.platformService.makeDirectory(this.platformService.storagePath());
			} else {
				return Promise.resolve();
			}
		});
	}

	private getJsonObjectFromFile(path: string): Promise<any> {
		return this.platformService.readTextFile(path).then(result => { return JSON.parse(result); });
	}
}
