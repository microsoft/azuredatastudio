/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import { IPlatformService } from './platformService';
import { BigDataClusterDeploymentProfile } from './bigDataClusterDeploymentProfile';

export interface BdcConfigListOutput {
	result: string[];
}

export interface IAzdataService {
	getDeploymentProfiles(): Promise<BigDataClusterDeploymentProfile[]>;
}

export class AzdataService implements IAzdataService {
	constructor(private platformService: IPlatformService) {
	}

	public async getDeploymentProfiles(): Promise<BigDataClusterDeploymentProfile[]> {
		await this.ensureWorkingDirectoryExists();
		const profileNames = await this.getDeploymentProfileNames();
		return await Promise.all(profileNames.map(profile => this.getDeploymentProfileInfo(profile)));
	}

	private async getDeploymentProfileNames(): Promise<string[]> {
		const env: NodeJS.ProcessEnv = {};
		// azdata requires this environment variables to be set
		env['ACCEPT_EULA'] = 'yes';
		const cmd = 'azdata bdc config list -o json';
		const stdout = await this.platformService.runCommand(cmd, { additionalEnvironmentVariables: env });
		const output = <BdcConfigListOutput>JSON.parse(stdout);
		return output.result;
	}

	private async getDeploymentProfileInfo(profileName: string): Promise<BigDataClusterDeploymentProfile> {
		const env: NodeJS.ProcessEnv = {};
		// azdata requires this environment variables to be set
		env['ACCEPT_EULA'] = 'yes';
		await this.platformService.runCommand(`azdata bdc config init --source ${profileName} --target ${profileName} --force`, { workingDirectory: this.platformService.storagePath(), additionalEnvironmentVariables: env });
		const configObjects = await Promise.all([
			this.getJsonObjectFromFile(path.join(this.platformService.storagePath(), profileName, 'bdc.json')),
			this.getJsonObjectFromFile(path.join(this.platformService.storagePath(), profileName, 'control.json'))
		]);
		return new BigDataClusterDeploymentProfile(profileName, configObjects[0], configObjects[1]);
	}

	private async ensureWorkingDirectoryExists(): Promise<void> {
		if (! await this.platformService.fileExists(this.platformService.storagePath())) {
			await this.platformService.makeDirectory(this.platformService.storagePath());
		}
	}

	private async getJsonObjectFromFile(path: string): Promise<any> {
		return JSON.parse(await this.platformService.readTextFile(path));
	}
}
