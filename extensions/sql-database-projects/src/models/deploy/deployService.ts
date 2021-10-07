/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppSettingType, IDeployAppIntegrationProfile, IDeployProfile, ILocalDbSetting } from './deployProfile';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { Project } from '../project';
import * as constants from '../../common/constants';
import * as utils from '../../common/utils';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import * as os from 'os';
import { ConnectionResult } from 'azdata';
import * as templates from '../../templates/templates';

interface DockerImageSpec {
	label: string;
	containerName: string;
	tag: string
}
export class DeployService {

	constructor(private _outputChannel: vscode.OutputChannel) {
	}

	private DefaultSqlRetryTimeoutInSec: number = 10;
	private DefaultSqlNumberOfRetries: number = 10;

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

	private findAppRuntime(profile: IDeployAppIntegrationProfile, appSettingContent: any): string | undefined {
		switch (profile.appSettingType) {
			case AppSettingType.AzureFunction:
				return <string>appSettingContent?.Values['FUNCTIONS_WORKER_RUNTIME'];
			default:
		}
		return undefined;
	}

	public async updateAppSettings(profile: IDeployAppIntegrationProfile, deployProfile: IDeployProfile | undefined): Promise<void> {
		// Update app settings
		//
		if (!profile.appSettingFile) {
			return;
		}
		this.logToOutput(constants.deployAppSettingUpdating(profile.appSettingFile));

		// TODO: handle parsing errors
		let content = JSON.parse(fse.readFileSync(profile.appSettingFile, 'utf8'));
		if (content && content.Values) {
			let connectionString: string | undefined = '';
			if (deployProfile && deployProfile.localDbSetting) {
				// Find the runtime and generate the connection string for the runtime
				//
				const runtime = this.findAppRuntime(profile, content);
				let connectionStringTemplate = this.createConnectionStringTemplate(runtime);
				const macroDict: Record<string, string> = {
					'SERVER': deployProfile?.localDbSetting?.serverName || '',
					'PORT': deployProfile?.localDbSetting?.port?.toString() || '',
					'USER': deployProfile?.localDbSetting?.userName || '',
					'SA_PASSWORD': deployProfile?.localDbSetting?.password || '',
					'DATABASE': deployProfile?.localDbSetting?.dbName || '',
				};

				connectionString = templates.macroExpansion(connectionStringTemplate, macroDict);
			} else if (deployProfile?.deploySettings?.connectionUri) {
				connectionString = await this.getConnectionString(deployProfile?.deploySettings?.connectionUri);
			}

			if (connectionString && profile.envVariableName) {
				content.Values[profile.envVariableName] = connectionString;
				await fse.writeFileSync(profile.appSettingFile, JSON.stringify(content, undefined, 4));
				this.logToOutput(`app setting '${profile.appSettingFile}' has been updated. env variable name: ${profile.envVariableName} connection String: ${connectionString}`);

			} else {
				this.logToOutput(constants.deployAppSettingUpdateFailed(profile.appSettingFile));
			}
		}
	}

	private async verifyDocker(): Promise<void> {
		try {
			await utils.executeCommand(`docker version --format {{.Server.APIVersion}}`, this._outputChannel);
			// TODO verify min version
		} catch (error) {
			throw Error(constants.dockerNotRunningError(utils.getErrorMessage(error)));
		}
	}

	public getDockerImageInfo(projectName: string, baseImage: string, imageUniqueId?: string): DockerImageSpec {

		imageUniqueId = imageUniqueId ?? UUID.generateUuid();
		// Remove unsupported characters
		//
		let imageProjectName = projectName.replace(/[^a-zA-Z0-9_,\-]/g, '');
		const tagMaxLength = 128;
		let tag = baseImage.replace(':', '-').replace(constants.sqlServerDockerRegistry, '').replace(/[^a-zA-Z0-9_,\-]/g, '');

		// cut the name if it's too long
		//
		imageProjectName = imageProjectName.substring(0, tagMaxLength - (constants.dockerImageNamePrefix.length + tag.length + 2));
		const imageLabel = `${constants.dockerImageLabelPrefix}-${imageProjectName}`.toLocaleLowerCase();
		const imageTag = `${constants.dockerImageNamePrefix}-${imageProjectName}-${tag}`.toLocaleLowerCase();
		const dockerName = `${constants.dockerImageNamePrefix}-${imageProjectName}-${imageUniqueId}`.toLocaleLowerCase();
		return { label: imageLabel, tag: imageTag, containerName: dockerName };
	}

	public async deploy(profile: IDeployProfile, project: Project): Promise<string | undefined> {
		return await this.executeTask(constants.deployDbTaskName, async () => {
			if (!profile.localDbSetting) {
				return undefined;
			}

			await this.verifyDocker();

			const imageInfo = this.getDockerImageInfo(project.projectFileName, profile.localDbSetting.dockerBaseImage);

			const root = project.projectFolderPath;
			const mssqlFolderPath = path.join(root, constants.mssqlFolderName);
			const commandsFolderPath = path.join(mssqlFolderPath, constants.commandsFolderName);
			const dockerFilePath = path.join(mssqlFolderPath, constants.dockerFileName);
			const startFilePath = path.join(commandsFolderPath, constants.startCommandName);

			// Clean up existing docker image
			const containerIds = await this.getCurrentDockerContainer(imageInfo.label);
			if (containerIds.length > 0) {
				const result = await vscode.window.showWarningMessage(constants.containerAlreadyExistForProject, constants.yesString, constants.noString);
				if (result === constants.yesString) {
					this.logToOutput(constants.cleaningDockerImagesMessage);
					await this.cleanDockerObjects(containerIds, ['docker stop', 'docker rm']);
				}
			}

			this.logToOutput(constants.creatingDeploymentSettingsMessage);
			// Create commands
			//

			await this.createCommands(mssqlFolderPath, commandsFolderPath, dockerFilePath, startFilePath, imageInfo.label, profile.localDbSetting.dockerBaseImage);

			this.logToOutput(constants.runningDockerMessage);
			// Building the image and running the docker
			//
			const createdDockerId: string | undefined = await this.buildAndRunDockerContainer(dockerFilePath, imageInfo, root, profile.localDbSetting);
			this.logToOutput(`Docker container created. Id: ${createdDockerId}`);


			// Waiting a bit to make sure docker container doesn't crash
			//
			const runningDockerId = await utils.retry('Validating the docker container', async () => {
				return await utils.executeCommand(`docker ps -q -a --filter label=${imageInfo.label} -q`, this._outputChannel);
			}, (dockerId) => {
				return Promise.resolve({ validated: dockerId !== undefined, errorMessage: constants.dockerContainerNotRunningErrorMessage });
			}, (dockerId) => {
				return Promise.resolve(dockerId);
			}, this._outputChannel
			);

			if (runningDockerId) {
				this.logToOutput(constants.dockerContainerCreatedMessage(runningDockerId));
				return await this.getConnection(profile.localDbSetting, false, 'master');

			} else {
				this.logToOutput(constants.dockerContainerFailedToRunErrorMessage);
				if (createdDockerId) {
					// Get the docker logs if docker was created but crashed
					await utils.executeCommand(constants.dockerLogMessage(createdDockerId), this._outputChannel);
				}
			}

			return undefined;
		});
	}

	private async buildAndRunDockerContainer(dockerFilePath: string, dockerImageSpec: DockerImageSpec, root: string, profile: ILocalDbSetting): Promise<string | undefined> {

		// Sensitive data to remove from output console
		const sensitiveData = [profile.password];

		// Running commands to build the docker image
		this.logToOutput('Building docker image ...');
		await utils.executeCommand(`docker pull ${profile.dockerBaseImage}`, this._outputChannel);
		await utils.executeCommand(`docker build -f ${dockerFilePath} -t ${dockerImageSpec.tag} ${root}`, this._outputChannel);
		await utils.executeCommand(`docker images --filter label=${dockerImageSpec.label}`, this._outputChannel);

		this.logToOutput('Running docker container ...');
		await utils.executeCommand(`docker run -p ${profile.port}:1433 -e "MSSQL_SA_PASSWORD=${profile.password}" -d --name ${dockerImageSpec.containerName} ${dockerImageSpec.tag}`, this._outputChannel, sensitiveData);
		return await utils.executeCommand(`docker ps -q -a --filter label=${dockerImageSpec.label} -q`, this._outputChannel);
	}

	private async getConnectionString(connectionUri: string): Promise<string | undefined> {
		const getAzdataApi = await utils.getAzdataApi();
		if (getAzdataApi) {
			const connection = await getAzdataApi.connection.getConnection(connectionUri);
			if (connection) {
				return await getAzdataApi.connection.getConnectionString(connection.connectionId, true);
			}
		}
		// TODO: vscode connections string

		return undefined;

	}

	// Connects to a database
	private async connectToDatabase(profile: ILocalDbSetting, savePassword: boolean, database: string): Promise<ConnectionResult | string | undefined> {
		const getAzdataApi = await utils.getAzdataApi();
		const vscodeMssqlApi = getAzdataApi ? undefined : await utils.getVscodeMssqlApi();
		if (getAzdataApi) {
			const connectionProfile = {
				password: profile.password,
				serverName: `${profile.serverName},${profile.port}`,
				database: database,
				savePassword: savePassword,
				userName: profile.userName,
				providerName: 'MSSQL',
				saveProfile: false,
				id: '',
				connectionName: `${constants.connectionNamePrefix} ${database}`,
				options: [],
				authenticationType: 'SqlLogin'
			};
			return await getAzdataApi.connection.connect(connectionProfile, false, false);
		} else if (vscodeMssqlApi) {
			const connectionProfile = {
				password: profile.password,
				server: `${profile.serverName}`,
				port: profile.port,
				database: database,
				savePassword: savePassword,
				user: profile.userName,
				authenticationType: 'SqlLogin',
				encrypt: false,
				connectTimeout: 30,
				applicationName: 'SQL Database Project',
				accountId: undefined,
				azureAccountToken: undefined,
				applicationIntent: undefined,
				attachDbFilename: undefined,
				connectRetryCount: undefined,
				connectRetryInterval: undefined,
				connectionString: undefined,
				currentLanguage: undefined,
				email: undefined,
				failoverPartner: undefined,
				loadBalanceTimeout: undefined,
				maxPoolSize: undefined,
				minPoolSize: undefined,
				multiSubnetFailover: undefined,
				multipleActiveResultSets: undefined,
				packetSize: undefined,
				persistSecurityInfo: undefined,
				pooling: undefined,
				replication: undefined,
				trustServerCertificate: undefined,
				typeSystemVersion: undefined,
				workstationId: undefined
			};
			let connectionUrl = await vscodeMssqlApi.connect(connectionProfile);
			return connectionUrl;
		} else {
			return undefined;
		}
	}

	// Validates the connection result. If using azdata API, verifies connection was successful and connection id is returns
	// If using vscode API, verifies the connection url is returns
	private async validateConnection(connection: ConnectionResult | string | undefined): Promise<utils.ValidationResult> {
		const getAzdataApi = await utils.getAzdataApi();
		if (!connection) {
			return { validated: false, errorMessage: constants.connectionFailedError('No result returned') };
		} else if (getAzdataApi) {
			const connectionResult = <ConnectionResult>connection;
			if (connectionResult) {
				const connected = connectionResult !== undefined && connectionResult.connected && connectionResult.connectionId !== undefined;
				return { validated: connected, errorMessage: connected ? '' : constants.connectionFailedError(connectionResult?.errorMessage) };
			} else {
				return { validated: false, errorMessage: constants.connectionFailedError('') };
			}
		} else {
			return { validated: connection !== undefined, errorMessage: constants.connectionFailedError('') };
		}
	}

	// Formats connection result to string to be able to add to log
	private async formatConnectionResult(connection: ConnectionResult | string | undefined): Promise<string> {
		const getAzdataApi = await utils.getAzdataApi();
		const connectionResult = connection !== undefined && getAzdataApi ? <ConnectionResult>connection : undefined;
		return connectionResult ? connectionResult.connectionId : <string>connection;
	}

	public async getConnection(profile: ILocalDbSetting, savePassword: boolean, database: string): Promise<string | undefined> {
		const getAzdataApi = await utils.getAzdataApi();
		let connection = await utils.retry(
			constants.connectingToSqlServerOnDockerMessage,
			async () => {
				return await this.connectToDatabase(profile, savePassword, database);
			},
			this.validateConnection,
			this.formatConnectionResult,
			this._outputChannel,
			this.DefaultSqlNumberOfRetries, profile.connectionRetryTimeout || this.DefaultSqlRetryTimeoutInSec);

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
		const getAzdataApi = await utils.getAzdataApi();
		if (getAzdataApi) {
			return new Promise<T>((resolve, reject) => {
				let msgTaskName = taskName;
				getAzdataApi!.tasks.startBackgroundOperation({
					displayName: msgTaskName,
					description: msgTaskName,
					isCancelable: false,
					operation: async op => {
						try {
							let result: T = await task();

							op.updateStatus(getAzdataApi!.TaskStatus.Succeeded);
							resolve(result);
						} catch (error) {
							let errorMsg = constants.taskFailedError(taskName, error ? error.message : '');
							op.updateStatus(getAzdataApi!.TaskStatus.Failed, errorMsg);
							reject(errorMsg);
						}
					}
				});
			});
		} else {
			return await task();
		}
	}

	private logToOutput(message: string): void {
		this._outputChannel.appendLine(message);
	}

	// Creates command file and docker file needed for deploy operation
	private async createCommands(mssqlFolderPath: string, commandsFolderPath: string, dockerFilePath: string, startFilePath: string, imageLabel: string, baseImage: string): Promise<void> {
		// Create mssql folders if doesn't exist
		//
		await utils.createFolderIfNotExist(mssqlFolderPath);
		await utils.createFolderIfNotExist(commandsFolderPath);

		// Start command
		//
		await this.createFile(startFilePath, 'echo starting the container!');
		if (os.platform() !== 'win32') {
			await utils.executeCommand(`chmod +x ${startFilePath}`, this._outputChannel);
		}

		// Create the Dockerfile
		//
		await this.createFile(dockerFilePath,
			`
FROM ${baseImage}
ENV ACCEPT_EULA=Y
ENV MSSQL_PID=Developer
LABEL ${imageLabel}
RUN mkdir -p /opt/sqlproject
COPY ${constants.mssqlFolderName}/${constants.commandsFolderName}/ /opt/commands
RUN ["/bin/bash", "/opt/commands/start.sh"]
`);
	}

	private async createFile(filePath: string, content: string): Promise<void> {
		this.logToOutput(`Creating file ${filePath}, content:${content}`);
		await fse.writeFile(filePath, content);
	}

	private async getCurrentIds(commandToRun: string): Promise<string[]> {
		const currentIds = await utils.executeCommand(commandToRun, this._outputChannel);
		return currentIds ? currentIds.split(/\r?\n/) : [];
	}

	public async getCurrentDockerContainer(imageLabel: string): Promise<string[]> {
		return await this.getCurrentIds(`docker ps -q -a --filter label=${imageLabel}`);
	}

	public async cleanDockerObjects(ids: string[], commandsToClean: string[]): Promise<void> {
		for (let index = 0; index < ids.length; index++) {
			const id = ids[index];
			if (id) {
				for (let commandId = 0; commandId < commandsToClean.length; commandId++) {
					const command = commandsToClean[commandId];
					await utils.executeCommand(`${command} ${id}`, this._outputChannel);
				}
			}
		}
	}
}
