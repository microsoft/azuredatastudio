/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDeployProfile } from './deployProfile';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { Project } from '../project';
import * as constants from '../../common/constants';
import * as utils from '../../common/utils';
let fse = require('fs-extra');
let path = require('path');
import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import * as os from 'os';
import { ConnectionResult } from 'azdata';

interface ValidationResult {
	errorMessage: string;
	validated: boolean
}
export class DeployService {

	constructor(private _outputChannel?: vscode.OutputChannel) {
	}

	public updateAppSettings(profile: IDeployProfile): void {

		// Update app settings
		if (profile.appSettingFile) {
			this.logToOutput(`Updating app setting: ${profile.appSettingFile}`);
			let connectionString = profile.connectionStringTemplate?.
				replace('{#SERVER#}', profile.serverName).
				replace('{#PORT#}', profile.port.toString()).
				replace('{#USER#}', profile.userName).
				replace('{#SA_PASSWORD#}', profile.password).
				replace('{#DATABASE#}', profile.dbName);

			let content = JSON.parse(fse.readFileSync(profile.appSettingFile, 'utf8'));
			if (content && profile.envVariableName) {
				if (!content.Values) {
					content.Values = [];
				}
				content.Values[profile.envVariableName] = connectionString;
				fse.writeFileSync(profile.appSettingFile, JSON.stringify(content, undefined, 4));
			}
			this.logToOutput(`app setting '${profile.appSettingFile}' has been updated`);
		}
	}

	public async deploy(profile: IDeployProfile, project: Project): Promise<string | undefined> {

		return await this.executeTask(constants.deployDbTaskName, async () => {
			const projectName = project.projectFileName;
			const imageLabel = `${constants.dockerImageLabelPrefix}_${projectName}`;
			const imageName = `${constants.dockerImageNamePrefix}-${projectName}-${UUID.generateUuid().toLowerCase()}`;
			const root = project.projectFolderPath;
			const mssqlFolderPath = path.join(root, constants.mssqlFolderName);
			const commandsFolderPath = path.join(mssqlFolderPath, constants.commandsFolderName);
			const dockerFilePath = path.join(mssqlFolderPath, constants.dockerFileName);
			const startFilePath = path.join(commandsFolderPath, constants.startCommandName);

			this.logToOutput('Cleaning existing deployments...');
			// Clean up existing docker image
			await this.cleanDockerObjects(`docker ps -q -a --filter label=${imageLabel}`, ['docker stop', 'docker rm']);
			await this.cleanDockerObjects(`docker images -f label=${imageLabel} -q`, [`docker rmi -f `]);

			this.logToOutput('Creating deployment settings ...');
			// Create commands
			//
			await this.createCommands(mssqlFolderPath, commandsFolderPath, dockerFilePath, startFilePath, imageLabel);

			this.logToOutput('Building and running the docker container ...');
			// Building the image and running the docker
			//
			const createdDockerId: string | undefined = await this.buildAndRunDockerContainer(dockerFilePath, imageName, root, profile, imageLabel);
			this.logToOutput(`Docker container created. Id: ${createdDockerId}`);


			// Waiting a bit to make sure docker container doesn't crash
			//
			const runningDockerId = await this.retry('Validating the docker container', async () => {
				return await this.executeCommand(`docker ps -q -a --filter label=${imageLabel} -q`);
			}, (dockerId) => {
				return { validated: dockerId !== undefined, errorMessage: 'Docker container is not running' };
			}, (dockerId) => {
				return dockerId;
			}
			);

			if (runningDockerId) {
				this.logToOutput(`Docker created id: ${runningDockerId}`);
				return await this.getConnection(profile);

			} else {
				this.logToOutput(`Failed to run the docker container`);
				if (createdDockerId) {
					// Get the docker logs if docker was created but crashed
					await this.executeCommand(`Docker logs: ${createdDockerId}`);
				}
			}
			return undefined;
		});
	}

	private async buildAndRunDockerContainer(dockerFilePath: string, imageName: string, root: string, profile: IDeployProfile, imageLabel: string): Promise<string | undefined> {
		this.logToOutput('Building docker image ...');
		await this.executeCommand(`docker pull ${constants.dockerBaseImage}`);
		await this.executeCommand(`docker build -f ${dockerFilePath} -t ${imageName} ${root}`);
		await this.executeCommand(`docker images --filter label=${imageLabel}`);

		this.logToOutput('Running docker container ...');
		await this.executeCommand(`docker run -p ${profile.port}:1433 -e "MSSQL_SA_PASSWORD=${profile.password}" -d ${imageName}`);
		return await this.executeCommand(`docker ps -q -a --filter label=${imageLabel} -q`);
	}

	private async getConnection(profile: IDeployProfile): Promise<string | undefined> {
		const getAzdataApi = await utils.getAzdataApi();
		const vscodeMssqlApi = getAzdataApi ? undefined : await utils.getVscodeMssqlApi();

		const connectionProfile = {
			password: profile.password,
			serverName: `${profile.serverName},${profile.port}`,
			server: `${profile.serverName},${profile.port}`,
			port: profile.port,
			database: '',
			savePassword: true,
			userName: profile.userName,
			user: profile.userName,
			providerName: 'MSSQL',
			saveProfile: true,
			id: '',
			connectionName: `${constants.connectionNamePrefix} ${profile.dbName}`,
			options: [],
			authenticationType: 'SqlLogin',
			email: '',
			accountId: '',
			azureAccountToken: '',
			encrypt: true,
			trustServerCertificate: true,
			persistSecurityInfo: false,
			connectTimeout: 30,
			connectRetryCount: 4,
			connectRetryInterval: 3,
			applicationName: 'SQL Project',
			workstationId: '',
			applicationIntent: '',
			currentLanguage: '',
			pooling: true,
			maxPoolSize: 5,
			minPoolSize: 2,
			loadBalanceTimeout: 30,
			replication: false,
			attachDbFilename: '',
			failoverPartner: '',
			multiSubnetFailover: false,
			multipleActiveResultSets: false,
			packetSize: 8000,
			typeSystemVersion: '',
			connectionString: ''
		};

		const connection = await this.retry('Connecting to SQL Server on Docker', async () => {
			if (getAzdataApi) {
				return await getAzdataApi.connection.connect(connectionProfile, true, false);
			} else if (vscodeMssqlApi) {
				return await vscodeMssqlApi.connect(connectionProfile);
			}
			return undefined;
		}, (connection) => {
			const connectionResult = <ConnectionResult>connection;
			if (connectionResult) {
				const connected = connectionResult !== undefined && connectionResult.connectionId !== undefined;
				return { validated: connected, errorMessage: connected ? '' : `Connection failed error: ${connectionResult?.errorMessage}` };
			} else {
				return { validated: connection !== undefined, errorMessage: 'Connection failed' };
			}
		}, (connection) => {
			const connectionResult = <ConnectionResult>connection;
			return connectionResult ? connectionResult.connectionId : <string>connection;
		});

		if (connection) {
			const connectionResult = <ConnectionResult>connection;
			if (getAzdataApi) {
				return await getAzdataApi.connection.getUriForConnection(connectionResult.connectionId);
			} else {
				return <string>connection;
			}
		}

		return undefined;
	}

	private async executeTask<T>(taskName: string, task: () => Promise<T>): Promise<T> {
		if (utils.getAzdataApi()) {
			return new Promise<T>((resolve, reject) => {
				let msgTaskName = taskName;
				utils.getAzdataApi()!.tasks.startBackgroundOperation({
					displayName: msgTaskName,
					description: msgTaskName,
					isCancelable: false,
					operation: async op => {
						try {
							let result: T = await task();

							op.updateStatus(utils.getAzdataApi()!.TaskStatus.Succeeded);
							resolve(result);
						} catch (error) {
							let errorMsg = constants.taskFailedError(taskName, error ? error.message : '');
							op.updateStatus(utils.getAzdataApi()!.TaskStatus.Failed, errorMsg);
							reject(errorMsg);
						}
					}
				});
			});
		} else {
			return await task();
		}
	}

	private async retry<T>(
		name: string, attempt: () => Promise<T>,
		verify: (result: T) => ValidationResult,
		formatResult: (result: T) => string,
		numberOfAttempts: number = 10,
		waitInSeconds: number = 2): Promise<T | undefined> {
		for (let count = 0; count < numberOfAttempts; count++) {
			this.logToOutput(`Waiting for ${waitInSeconds / 1000} seconds before another attempt for operation '${name}'`);
			await new Promise(c => setTimeout(c, waitInSeconds * 1000));
			this.logToOutput(`Running operation '${name}' Attempt ${count} from ${numberOfAttempts}`);

			try {
				let result = await attempt();
				const validationResult = verify(result);
				if (validationResult.validated) {
					this.logToOutput(`Operation '${name}' completed Successfully. Result: ${formatResult(result)}`);
					return result;
				} else {
					this.logToOutput(`Operation '${name}' failed. Re-trying... Current Result: ${formatResult(result)}. Error: '${validationResult.errorMessage}'`);
				}

			} catch (err) {
				this.logToOutput(`Operation '${name}' failed. Re-trying... Error: '${err}'`);
			}
		}

		return undefined;
	}

	private logToOutput(message: string): void {
		if (this._outputChannel) {
			this._outputChannel.appendLine(message);
		}
	}

	private async createCommands(mssqlFolderPath: string, commandsFolderPath: string, dockerFilePath: string, startFilePath: string, imageLabel: string): Promise<void> {
		// Create mssql folders if doesn't exist
		//
		this.createFolderIfNotExist(mssqlFolderPath);
		this.createFolderIfNotExist(commandsFolderPath);

		// Start command
		//
		this.createFile(startFilePath, 'echo starting the container!');
		if (os.platform() !== 'win32') {
			await this.executeCommand(`chmod +x ${startFilePath}`);
		}

		// Create the Dockerfile
		//
		this.createFile(dockerFilePath,
			`
FROM ${constants.dockerBaseImage}
ENV ACCEPT_EULA=Y
ENV MSSQL_PID=Developer
LABEL ${imageLabel}
RUN mkdir -p /opt/sqlproject
COPY ${constants.mssqlFolderName}/${constants.commandsFolderName}/ /opt/commands
RUN ["/bin/bash", "/opt/commands/start.sh"]
`);
	}

	private createFolderIfNotExist(folderName: string): void {
		if (!fse.existsSync(folderName)) {
			fse.mkdirSync(folderName);
		}
	}

	private createFile(filePath: string, content: string): void {
		this.logToOutput(`Creating file ${filePath}, content:${content}`);
		fse.writeFile(filePath, content);
	}

	private async cleanDockerObjects(commandToGetObjects: string, commandsToClean: string[]): Promise<void> {
		let currentIds = await this.executeCommand(commandToGetObjects);
		if (currentIds) {
			const ids = currentIds.split(/\r?\n/);
			for (let index = 0; index < ids.length; index++) {
				const id = ids[index];
				if (id) {
					for (let commandId = 0; commandId < commandsToClean.length; commandId++) {
						const command = commandsToClean[commandId];
						await this.executeCommand(`${command} ${id}`);

					}
				}
			}
		}
	}

	private async executeCommand(cmd: string, timeout: number = 1800000): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			this.logToOutput(`    > ${cmd}`);
			let child = childProcess.exec(cmd, {
				timeout: timeout
			}, (err, stdout) => {
				if (err) {
					reject(err);
				} else {
					resolve(stdout);
				}
			});

			// Add listeners to print stdout and stderr if an output channel was provided

			if (child.stdout) {
				child.stdout.on('data', data => { this.outputDataChunk(data, '    stdout: '); });
			}
			if (child.stderr) {
				child.stderr.on('data', data => { this.outputDataChunk(data, '    stderr: '); });
			}
		});
	}

	private outputDataChunk(data: string | Buffer, header: string): void {
		data.toString().split(/\r?\n/)
			.forEach(line => {
				this.logToOutput(header + line);
			});
	}
}
