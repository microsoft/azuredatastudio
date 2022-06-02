/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppSettingType, IDeployAppIntegrationProfile, ILocalDbDeployProfile, ILocalDbSetting, ISqlConnectionProperties, ISqlDbDeployProfile } from './deployProfile';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { Project } from '../project';
import * as constants from '../../common/constants';
import * as utils from '../../common/utils';
import * as fse from 'fs-extra';
import * as vscode from 'vscode';
import { ConnectionResult } from 'azdata';
import * as templates from '../../templates/templates';
import { ShellExecutionHelper } from '../../tools/shellExecutionHelper';
import { AzureSqlClient } from './azureSqlClient';
import { IFireWallRuleError } from 'vscode-mssql';

interface DockerImageSpec {
	label: string;
	containerName: string;
	tag: string
}
export class DeployService {

	constructor(private _azureSqlClient = new AzureSqlClient(), private _outputChannel: vscode.OutputChannel, shellExecutionHelper: ShellExecutionHelper | undefined = undefined) {
		this._shellExecutionHelper = shellExecutionHelper ?? new ShellExecutionHelper(this._outputChannel);
	}

	private _shellExecutionHelper: ShellExecutionHelper;
	private DefaultSqlRetryTimeoutInSec: number = 10;
	private DefaultSqlNumberOfRetries: number = 3;

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

	public async updateAppSettings(profile: IDeployAppIntegrationProfile, deployProfile: ILocalDbDeployProfile | undefined): Promise<void> {
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
				fse.writeFileSync(profile.appSettingFile, JSON.stringify(content, undefined, 4));
				this.logToOutput(`app setting '${profile.appSettingFile}' has been updated. env variable name: ${profile.envVariableName} connection String: ${connectionString}`);

			} else {
				this.logToOutput(constants.deployAppSettingUpdateFailed(profile.appSettingFile));
			}
		}
	}

	private async verifyDocker(): Promise<void> {
		try {
			await this.executeCommand(`docker version --format {{.Server.APIVersion}}`);
			// TODO verify min version
		} catch (error) {
			throw Error(constants.dockerNotRunningError(utils.getErrorMessage(error)));
		}
	}

	public getDockerImageSpec(projectName: string, baseImage: string, imageUniqueId?: string): DockerImageSpec {

		imageUniqueId = imageUniqueId ?? UUID.generateUuid();
		// Remove unsupported characters
		//

		// docker image name and tag can only include letters, digits, underscore, period and dash
		const regexForDockerImageName = /[^a-zA-Z0-9_,\-]/g;

		let imageProjectName = projectName.replace(regexForDockerImageName, '');
		const tagMaxLength = 128;
		const tag = baseImage.replace(':', '-').replace(constants.sqlServerDockerRegistry, '').replace(regexForDockerImageName, '');

		// cut the name if it's too long
		//
		imageProjectName = imageProjectName.substring(0, tagMaxLength - (constants.dockerImageNamePrefix.length + tag.length + 2));
		const imageLabel = `${constants.dockerImageLabelPrefix}-${imageProjectName}`.toLocaleLowerCase();
		const imageTag = `${constants.dockerImageNamePrefix}-${imageProjectName}-${tag}`.toLocaleLowerCase();
		const dockerName = `${constants.dockerImageNamePrefix}-${imageProjectName}-${imageUniqueId}`.toLocaleLowerCase();
		return { label: imageLabel, tag: imageTag, containerName: dockerName };
	}

	/**
	 * Creates a new Azure Sql server and tries to connect to the new server. If connection fails because of firewall rule, it prompts user to add firewall rule settings
	 * @param profile Azure Sql server settings
	 * @returns connection url for the new server
	 */
	public async createNewAzureSqlServer(profile: ISqlDbDeployProfile | undefined): Promise<string | undefined> {
		if (!profile?.sqlDbSetting) {
			return undefined;
		}

		this.logToOutput(constants.creatingAzureSqlServer(profile?.sqlDbSetting?.serverName));

		// Create the server
		const server = await this._azureSqlClient.createOrUpdateServer(profile.sqlDbSetting.session, profile?.sqlDbSetting.resourceGroupName, profile?.sqlDbSetting.serverName, {
			location: profile?.sqlDbSetting?.location,
			administratorLogin: profile?.sqlDbSetting.userName,
			administratorLoginPassword: profile?.sqlDbSetting.password
		});
		if (server) {
			this._outputChannel.appendLine(constants.serverCreated);
			profile.sqlDbSetting.serverName = server;

			this.logToOutput(constants.azureSqlServerCreated(profile?.sqlDbSetting?.serverName));

			// Connect to the server
			return await this.getConnection(profile.sqlDbSetting, false, constants.master);
		}
		return undefined;
	}

	public async deployToContainer(profile: ILocalDbDeployProfile, project: Project): Promise<string | undefined> {
		return await this.executeTask(constants.deployDbTaskName, async () => {
			if (!profile.localDbSetting) {
				return undefined;
			}

			await this.verifyDocker();
			this.logToOutput(constants.dockerImageMessage);
			this.logToOutput(profile.localDbSetting.dockerBaseImage);

			this.logToOutput(constants.dockerImageEulaMessage);
			this.logToOutput(profile.localDbSetting.dockerBaseImageEula);

			const imageSpec = this.getDockerImageSpec(project.projectFileName, profile.localDbSetting.dockerBaseImage);

			// If profile name is not set use the docker name to have a unique name
			if (!profile.localDbSetting.profileName) {
				profile.localDbSetting.profileName = imageSpec.containerName;
			}

			this.logToOutput(constants.cleaningDockerImagesMessage);
			// Clean up existing docker image
			const containerIds = await this.getCurrentDockerContainer(imageSpec.label);
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

			this.logToOutput(constants.runningDockerMessage);
			// Building the image and running the docker
			//
			const createdDockerId: string | undefined = await this.runDockerContainer(imageSpec, profile.localDbSetting);
			this.logToOutput(`Docker container created. Id: ${createdDockerId}`);


			// Waiting a bit to make sure docker container doesn't crash
			//
			const runningDockerId = await utils.retry('Validating the docker container', async () => {
				return this.executeCommand(`docker ps -q -a --filter label=${imageSpec.label} -q`);
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
					await this.executeCommand(constants.dockerLogMessage(createdDockerId));
				}
			}

			return undefined;
		});
	}

	private async runDockerContainer(dockerImageSpec: DockerImageSpec, profile: ILocalDbSetting): Promise<string | undefined> {

		// Sensitive data to remove from output console
		const sensitiveData = [profile.password];

		// Running commands to build the docker image
		await this.executeCommand(`docker pull ${profile.dockerBaseImage}`);

		await this.executeCommand(`docker run -p ${profile.port}:1433 -e "MSSQL_SA_PASSWORD=${profile.password}" -e "ACCEPT_EULA=Y" -e "MSSQL_PID=Developer" --label ${dockerImageSpec.label} -d --name ${dockerImageSpec.containerName} ${profile.dockerBaseImage} `, sensitiveData);
		return await this.executeCommand(`docker ps -q -a --filter label=${dockerImageSpec.label} -q`);
	}

	private async getConnectionString(connectionUri: string): Promise<string | undefined> {
		const azdataApi = utils.getAzdataApi();
		if (azdataApi) {
			const connection = await azdataApi.connection.getConnection(connectionUri);
			if (connection) {
				return await azdataApi.connection.getConnectionString(connection.connectionId, true);
			}
		}
		// TODO: vscode connections string

		return undefined;

	}

	// Connects to a database
	private async connectToDatabase(profile: ISqlConnectionProperties, saveConnectionAndPassword: boolean, database: string): Promise<ConnectionResult | string | undefined> {
		const azdataApi = utils.getAzdataApi();
		const vscodeMssqlApi = azdataApi ? undefined : await utils.getVscodeMssqlApi();
		if (azdataApi) {
			const connectionProfile = {
				password: profile.password,
				serverName: `${profile.serverName},${profile.port}`,
				database: database,
				savePassword: saveConnectionAndPassword,
				userName: profile.userName,
				providerName: 'MSSQL',
				saveProfile: false,
				id: '',
				connectionName: profile.profileName,
				options: [],
				authenticationType: 'SqlLogin'
			};
			return await azdataApi.connection.connect(connectionProfile, saveConnectionAndPassword, false);
		} else if (vscodeMssqlApi) {
			const connectionProfile = {
				password: profile.password,
				server: `${profile.serverName}`,
				port: profile.port,
				database: database,
				savePassword: saveConnectionAndPassword,
				user: profile.userName,
				authenticationType: 'SqlLogin',
				encrypt: false,
				connectTimeout: 30,
				applicationName: 'SQL Database Project',
				accountId: profile.accountId,
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
				workstationId: undefined,
				profileName: profile.profileName,
				expiresOn: undefined,
				tenantId: profile.tenantId
			};
			let connectionUrl = '';
			try {
				connectionUrl = await vscodeMssqlApi.connect(connectionProfile, saveConnectionAndPassword);
			} catch (err) {
				const firewallRuleError = <IFireWallRuleError>err;
				if (firewallRuleError?.connectionUri) {
					await vscodeMssqlApi.promptForFirewallRule(err.connectionUri, connectionProfile);
				} else {
					throw err;
				}
			}
			return connectionUrl;
		} else {
			return undefined;
		}
	}

	// Validates the connection result. If using azdata API, verifies connection was successful and connection id is returns
	// If using vscode API, verifies the connection url is returns
	private async validateConnection(connection: ConnectionResult | string | undefined): Promise<utils.ValidationResult> {
		const azdataApi = utils.getAzdataApi();
		if (!connection) {
			return { validated: false, errorMessage: constants.connectionFailedError('No result returned') };
		} else if (azdataApi) {
			const connectionResult = <ConnectionResult>connection;
			if (connectionResult) {
				const connected = connectionResult !== undefined && connectionResult.connected && connectionResult.connectionId !== undefined;
				return { validated: connected, errorMessage: connected ? '' : constants.connectionFailedError(connectionResult?.errorMessage!) };
			} else {
				return { validated: false, errorMessage: constants.connectionFailedError('') };
			}
		} else {
			return { validated: connection !== undefined, errorMessage: constants.connectionFailedError('') };
		}
	}

	// Formats connection result to string to be able to add to log
	private async formatConnectionResult(connection: ConnectionResult | string | undefined): Promise<string> {
		const azdataApi = utils.getAzdataApi();
		const connectionResult = connection !== undefined && azdataApi ? <ConnectionResult>connection : undefined;
		return connectionResult?.connected ? connectionResult.connectionId! : <string>connection;
	}

	public async getConnection(profile: ISqlConnectionProperties, saveConnectionAndPassword: boolean, database: string): Promise<string | undefined> {
		const azdataApi = utils.getAzdataApi();
		let connection = await utils.retry(
			constants.connectingToSqlServerMessage,
			async () => {
				return await this.connectToDatabase(profile, saveConnectionAndPassword, database);
			},
			this.validateConnection,
			this.formatConnectionResult,
			this._outputChannel,
			this.DefaultSqlNumberOfRetries, profile.connectionRetryTimeout || this.DefaultSqlRetryTimeoutInSec);

		if (connection) {
			const connectionResult = <ConnectionResult>connection;
			if (azdataApi) {
				utils.throwIfNotConnected(connectionResult);
				return azdataApi.connection.getUriForConnection(connectionResult.connectionId!);
			} else {
				return <string>connection;
			}
		}

		return undefined;
	}

	private async executeTask<T>(taskName: string, task: () => Promise<T>): Promise<T> {
		const azdataApi = utils.getAzdataApi();
		if (azdataApi) {
			return new Promise<T>((resolve, reject) => {
				let msgTaskName = taskName;
				azdataApi!.tasks.startBackgroundOperation({
					displayName: msgTaskName,
					description: msgTaskName,
					isCancelable: false,
					operation: async op => {
						try {
							let result: T = await task();

							op.updateStatus(azdataApi!.TaskStatus.Succeeded);
							resolve(result);
						} catch (error) {
							let errorMsg = constants.taskFailedError(taskName, error ? error.message : '');
							op.updateStatus(azdataApi!.TaskStatus.Failed, errorMsg);
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

	public async executeCommand(cmd: string, sensitiveData: string[] = [], timeout: number = 5 * 60 * 1000): Promise<string> {
		return await this._shellExecutionHelper.runStreamedCommand(cmd, undefined, sensitiveData, timeout);
	}

	public async getCurrentDockerContainer(imageLabel: string): Promise<string[]> {
		const currentIds = await this.executeCommand(`docker ps -q -a --filter label=${imageLabel}`);
		return currentIds ? currentIds.split(/\r?\n/) : [];
	}

	public async cleanDockerObjects(ids: string[], commandsToClean: string[]): Promise<void> {
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
