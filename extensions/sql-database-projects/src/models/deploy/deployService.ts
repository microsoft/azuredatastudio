/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppSettingType, IDeployProfile, ILocalDbSetting } from './deployProfile';
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

	constructor(private _outputChannel: vscode.OutputChannel) {
	}

	private createConnectionStringTemplate(runtime: string | undefined): string {
		switch (runtime?.toLocaleLowerCase()) {
			case 'dotnet':
				return constants.defaultConnectionStringTemplate;
				break;
			// TODO: add connection strings for other languages
			default:
				break;
		}
		return '';
	}

	private findAppRuntime(profile: IDeployProfile, appSettingContent: any): string | undefined {
		switch (profile.appSettingType) {
			case AppSettingType.AzureFunction:
				return <string>appSettingContent?.Values['FUNCTIONS_WORKER_RUNTIME'];
			default:
		}
		return undefined;
	}

	public async updateAppSettings(profile: IDeployProfile): Promise<void> {
		// Update app settings
		//
		if (profile.appSettingFile) {
			this.logToOutput(`Updating app setting: ${profile.appSettingFile}`);

			let content = JSON.parse(fse.readFileSync(profile.appSettingFile, 'utf8'));
			if (content && content.Values) {
				let connectionString: string | undefined = '';
				if (profile.localDbSetting) {
					// Find the runtime and generate the connection string for the runtime
					//
					const runtime = this.findAppRuntime(profile, content);
					let connectionStringTemplate = this.createConnectionStringTemplate(runtime);
					connectionString = connectionStringTemplate?.
						replace('{#SERVER#}', profile?.localDbSetting?.serverName || '').
						replace('{#PORT#}', profile?.localDbSetting?.port?.toString() || '').
						replace('{#USER#}', profile?.localDbSetting?.userName || '').
						replace('{#SA_PASSWORD#}', profile?.localDbSetting?.password || '').
						replace('{#DATABASE#}', profile?.localDbSetting?.dbName || '');
				} else if (profile.deploySettings?.connectionUri) {
					connectionString = await this.getConnectionString(profile.deploySettings?.connectionUri);
				}

				if (connectionString && profile.envVariableName) {
					content.Values[profile.envVariableName] = connectionString;
					fse.writeFileSync(profile.appSettingFile, JSON.stringify(content, undefined, 4));
					this.logToOutput(`app setting '${profile.appSettingFile}' has been updated`);

				} else {
					this.logToOutput(constants.deployAppSettingUpdateFailed(profile.appSettingFile));
				}
			}
		}
	}

	public async deploy(profile: IDeployProfile, project: Project): Promise<string | undefined> {

		return await this.executeTask(constants.deployDbTaskName, async () => {
			if (profile.localDbSetting) {
				const projectName = project.projectFileName;
				const imageLabel = `${constants.dockerImageLabelPrefix}_${projectName}`;
				const imageName = `${constants.dockerImageNamePrefix}-${projectName}-${UUID.generateUuid().toLowerCase()}`;
				const root = project.projectFolderPath;
				const mssqlFolderPath = path.join(root, constants.mssqlFolderName);
				const commandsFolderPath = path.join(mssqlFolderPath, constants.commandsFolderName);
				const dockerFilePath = path.join(mssqlFolderPath, constants.dockerFileName);
				const startFilePath = path.join(commandsFolderPath, constants.startCommandName);

				this.logToOutput(constants.cleaningDockerImagesMessage);
				// Clean up existing docker image

				await this.cleanDockerObjects(`docker ps -q -a --filter label=${imageLabel}`, ['docker stop', 'docker rm']);
				await this.cleanDockerObjects(`docker images -f label=${imageLabel} -q`, [`docker rmi -f `]);

				this.logToOutput(constants.creatingDeploymentSettingsMessage);
				// Create commands
				//

				await this.createCommands(mssqlFolderPath, commandsFolderPath, dockerFilePath, startFilePath, imageLabel);

				this.logToOutput(constants.runningDockerMessage);
				// Building the image and running the docker
				//
				const createdDockerId: string | undefined = await this.buildAndRunDockerContainer(dockerFilePath, imageName, root, profile.localDbSetting, imageLabel);
				this.logToOutput(`Docker container created. Id: ${createdDockerId}`);


				// Waiting a bit to make sure docker container doesn't crash
				//
				const runningDockerId = await this.retry('Validating the docker container', async () => {
					return await this.executeCommand(`docker ps -q -a --filter label=${imageLabel} -q`);
				}, (dockerId) => {
					return { validated: dockerId !== undefined, errorMessage: constants.dockerContainerNotRunningErrorMessage };
				}, (dockerId) => {
					return dockerId;
				}
				);

				if (runningDockerId) {
					this.logToOutput(constants.dockerContainerCreatedMessage(runningDockerId));
					return await this.getConnection(profile.localDbSetting);

				} else {
					this.logToOutput(constants.dockerContainerFailedToRunErrorMessage);
					if (createdDockerId) {
						// Get the docker logs if docker was created but crashed
						await this.executeCommand(constants.dockerLogMessage(createdDockerId));
					}
				}

			}
			return undefined;
		});
	}

	private async buildAndRunDockerContainer(dockerFilePath: string, imageName: string, root: string, profile: ILocalDbSetting, imageLabel: string): Promise<string | undefined> {
		this.logToOutput('Building docker image ...');
		await this.executeCommand(`docker pull ${constants.dockerBaseImage}`);
		await this.executeCommand(`docker build -f ${dockerFilePath} -t ${imageName} ${root}`);
		await this.executeCommand(`docker images --filter label=${imageLabel}`);

		this.logToOutput('Running docker container ...');
		await this.executeCommand(`docker run -p ${profile.port}:1433 -e "MSSQL_SA_PASSWORD=${profile.password}" -d ${imageName}`);
		return await this.executeCommand(`docker ps -q -a --filter label=${imageLabel} -q`);
	}

	private async getConnectionString(connectionUri: string): Promise<string | undefined> {
		const getAzdataApi = await utils.getAzdataApi();
		//const vscodeMssqlApi = getAzdataApi ? undefined : await utils.getVscodeMssqlApi();
		if (getAzdataApi) {
			const connection = await getAzdataApi.connection.getConnection(connectionUri);
			if (connection) {
				return await getAzdataApi.connection.getConnectionString(connection.connectionId, true);
			}
		}
		// TODO: vscode connections string

		return undefined;

	}

	private async getConnection(profile: ILocalDbSetting): Promise<string | undefined> {
		const getAzdataApi = await utils.getAzdataApi();
		const vscodeMssqlApi = getAzdataApi ? undefined : await utils.getVscodeMssqlApi();

		const connectionProfile = {
			password: profile.password,
			serverName: `${profile.serverName},${profile.port}`,
			server: `${profile.serverName}`,
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
			email: undefined,
			accountId: undefined,
			azureAccountToken: undefined,
			encrypt: undefined,
			trustServerCertificate: undefined,
			persistSecurityInfo: undefined,
			connectTimeout: undefined,
			connectRetryCount: undefined,
			connectRetryInterval: undefined,
			applicationName: undefined,
			workstationId: undefined,
			applicationIntent: undefined,
			currentLanguage: undefined,
			pooling: undefined,
			maxPoolSize: undefined,
			minPoolSize: undefined,
			loadBalanceTimeout: undefined,
			replication: undefined,
			attachDbFilename: undefined,
			failoverPartner: undefined,
			multiSubnetFailover: undefined,
			multipleActiveResultSets: undefined,
			packetSize: undefined,
			typeSystemVersion: undefined,
			connectionString: undefined
		};

		const connection = await this.retry(constants.connectingToSqlServerOnDockerMessage, async () => {
			if (getAzdataApi) {
				return await getAzdataApi.connection.connect(connectionProfile, true, false);
			} else if (vscodeMssqlApi) {
				return await vscodeMssqlApi.connect(connectionProfile);
			}
			return undefined;
		}, (connection) => {
			const connectionResult = <ConnectionResult>connection;
			if (connectionResult) {
				const connected = connectionResult !== undefined && connectionResult.connected && connectionResult.connectionId !== undefined;
				return { validated: connected, errorMessage: connected ? '' : constants.connectionFailedError(connectionResult?.errorMessage) };
			} else {
				return { validated: connection !== undefined, errorMessage: constants.connectionFailedError('') };
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
			this.logToOutput(constants.retryWaitMessage(waitInSeconds / 1000, name));
			await new Promise(c => setTimeout(c, waitInSeconds * 1000));
			this.logToOutput(constants.retryRunMessage(count, numberOfAttempts, name));

			try {
				let result = await attempt();
				const validationResult = verify(result);
				if (validationResult.validated) {
					this.logToOutput(constants.retrySucceedMessage(name, formatResult(result)));
					return result;
				} else {
					this.logToOutput(constants.retryFailedMessage(name, formatResult(result), validationResult.errorMessage));
				}

			} catch (err) {
				this.logToOutput(constants.retryMessage(name, err));
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
		await this.createFile(startFilePath, 'echo starting the container!');
		if (os.platform() !== 'win32') {
			await this.executeCommand(`chmod +x ${startFilePath}`);
		}

		// Create the Dockerfile
		//
		await this.createFile(dockerFilePath,
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

	private async createFile(filePath: string, content: string): Promise<void> {
		this.logToOutput(`Creating file ${filePath}, content:${content}`);
		await fse.writeFile(filePath, content);
	}

	public async cleanDockerObjects(commandToGetObjects: string, commandsToClean: string[]): Promise<void> {
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

			if (child?.stdout) {
				child.stdout.on('data', data => { this.outputDataChunk(data, '    stdout: '); });
			}
			if (child?.stderr) {
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
