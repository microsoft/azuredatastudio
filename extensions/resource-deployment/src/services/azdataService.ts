/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import { IPlatformService } from './platformService';
import { BigDataClusterDeploymentProfile } from './bigDataClusterDeploymentProfile';
import { BdcDeploymentType } from '../interfaces';

interface BdcConfigListOutput {
	result: string[];
}

export interface BdcEndpoint {
	endpoint: string;
	name: 'sql-server-master';
}

export interface IAzdataService {
	getDeploymentProfiles(deploymentType: BdcDeploymentType): Promise<BigDataClusterDeploymentProfile[]>;
	getEndpoints(clusterName: string, userName: string, password: string): Promise<BdcEndpoint[]>;
}

export class AzdataService implements IAzdataService {
	constructor(private platformService: IPlatformService) {
	}

	public async getDeploymentProfiles(deploymentType: BdcDeploymentType): Promise<BigDataClusterDeploymentProfile[]> {
		let profilePrefix: string;
		switch (deploymentType) {
			case BdcDeploymentType.NewAKS:
			case BdcDeploymentType.ExistingAKS:
				profilePrefix = 'aks';
				break;
			case BdcDeploymentType.ExistingKubeAdm:
				profilePrefix = 'kubeadm';
				break;
			default:
				throw new Error(`Unknown deployment type: ${deploymentType}`);
		}
		const profileNames = await this.getDeploymentProfileNames();
		return await Promise.all(profileNames.filter(profile => profile.startsWith(profilePrefix)).map(profile => this.getDeploymentProfileInfo(profile)));
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

	private async getJsonObjectFromFile(path: string): Promise<any> {
		return JSON.parse(await this.platformService.readTextFile(path));
	}

	public async getEndpoints(clusterName: string, userName: string, password: string): Promise<BdcEndpoint[]> {
		const env: NodeJS.ProcessEnv = {};
		env['AZDATA_USERNAME'] = userName;
		env['AZDATA_PASSWORD'] = password;
		env['ACCEPT_EULA'] = 'yes';
		let cmd = 'azdata login -n ' + clusterName;
		await this.platformService.runCommand(cmd, { additionalEnvironmentVariables: env });
		cmd = 'azdata bdc endpoint list';
		const stdout = await this.platformService.runCommand(cmd, { additionalEnvironmentVariables: env });
		return <BdcEndpoint[]>JSON.parse(stdout);
	}
}
