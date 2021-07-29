/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PGResourceInfo } from 'arc';
import * as azdata from 'azdata';
import * as azExt from 'az-ext';
import * as vscode from 'vscode';
import * as loc from '../localizedConstants';
import { ConnectToPGSqlDialog } from '../ui/dialogs/connectPGDialog';
import { AzureArcTreeDataProvider } from '../ui/tree/azureArcTreeDataProvider';
import { ControllerModel, Registration } from './controllerModel';
import { parseIpAndPort } from '../common/utils';
import { UserCancelledError } from '../common/api';
import { ResourceModel } from './resourceModel';
import { Deferred } from '../common/promise';

export type EngineSettingsModel = {
	parameterName: string | undefined,
	value: string | undefined,
	description: string | undefined,
	min: string | undefined,
	max: string | undefined,
	options: string | undefined,
	type: string | undefined
};

export class PostgresModel extends ResourceModel {
	private _config?: azExt.PostgresServerShowResult;
	public workerNodesEngineSettings: EngineSettingsModel[] = [];
	public coordinatorNodeEngineSettings: EngineSettingsModel[] = [];
	private readonly _azApi: azExt.IExtension;

	private readonly _onConfigUpdated = new vscode.EventEmitter<azExt.PostgresServerShowResult>();
	public onConfigUpdated = this._onConfigUpdated.event;
	public configLastUpdated?: Date;
	public engineSettingsLastUpdated?: Date;

	private _refreshPromise?: Deferred<void>;
	private _engineSettingsPromise?: Deferred<void>;

	constructor(_controllerModel: ControllerModel, private _pgInfo: PGResourceInfo, registration: Registration, private _treeDataProvider: AzureArcTreeDataProvider) {
		super(_controllerModel, _pgInfo, registration);
		this._azApi = <azExt.IExtension>vscode.extensions.getExtension(azExt.extension.name)?.exports;
	}

	/** Returns the configuration of Postgres */
	public get config(): azExt.PostgresServerShowResult | undefined {
		return this._config;
	}

	/** Returns the major version of Postgres */
	public get engineVersion(): string | undefined {
		return this._config?.spec.engine.version;
	}

	/** Returns the IP address and port of Postgres */
	public get endpoint(): { ip: string, port: string } | undefined {
		return this._config?.status.primaryEndpoint
			? parseIpAndPort(this._config.status.primaryEndpoint)
			: undefined;
	}

	/** Returns the scale configuration of Postgres e.g. '3 nodes, 1.5 vCores, 1Gi RAM, 2Gi storage per node' */
	public get scaleConfiguration(): string | undefined {
		if (!this._config) {
			return undefined;
		}

		const cpuLimit = this._config.spec.scheduling?.default?.resources?.limits?.cpu;
		const ramLimit = this._config.spec.scheduling?.default?.resources?.limits?.memory;
		const cpuRequest = this._config.spec.scheduling?.default?.resources?.requests?.cpu;
		const ramRequest = this._config.spec.scheduling?.default?.resources?.requests?.memory;
		const dataStorage = this._config.spec.storage?.data?.volumes?.[0]?.size;
		const logStorage = this._config.spec.storage?.logs?.volumes?.[0]?.size;
		const backupsStorage = this._config.spec.storage?.backups?.volumes?.[0]?.size;

		// scale.shards was renamed to scale.workers. Check both for backwards compatibility.
		const scale = this._config.spec.scale;
		const nodes = (scale?.workers ?? scale?.shards ?? 0) + 1; // An extra node for the coordinator

		let configuration: string[] = [];
		configuration.push(`${nodes} ${nodes > 1 ? loc.nodes : loc.node}`);

		// Prefer limits if they're provided, otherwise use requests if they're provided
		if (cpuLimit || cpuRequest) {
			configuration.push(`${cpuLimit ?? cpuRequest!} ${loc.vCores}`);
		}

		if (ramLimit || ramRequest) {
			configuration.push(`${ramLimit ?? ramRequest!} ${loc.ram}`);
		}

		let storage: string[] = [];
		if (dataStorage) {
			storage.push(loc.dataStorage(dataStorage));
		}
		if (logStorage) {
			storage.push(loc.logStorage(logStorage));
		}
		if (backupsStorage) {
			storage.push(loc.backupsStorage(backupsStorage));
		}
		if (dataStorage || logStorage || backupsStorage) {
			storage.push(`${loc.storagePerNode}`);
			configuration.push(storage.join(' '));
		}

		return configuration.join(', ');
	}

	/** Refreshes the model */
	public async refresh() {
		// Only allow one refresh to be happening at a time
		if (this._refreshPromise) {
			return this._refreshPromise.promise;
		}
		this._refreshPromise = new Deferred();
		try {
			this._config = (await this._azApi.az.postgres.arcserver.show(this.info.name, this.controllerModel.info.namespace, this.controllerModel.azAdditionalEnvVars)).stdout;
			this.configLastUpdated = new Date();
			this._onConfigUpdated.fire(this._config);
			this._refreshPromise.resolve();
		} catch (err) {
			this._refreshPromise.reject(err);
			throw err;
		} finally {
			this._refreshPromise = undefined;
		}
	}

	public async getEngineSettings(): Promise<void> {
		// Only allow to get engine setting once at a time
		if (this._engineSettingsPromise) {
			return this._engineSettingsPromise.promise;
		}
		this._engineSettingsPromise = new Deferred();

		try {
			if (!this._connectionProfile) {
				await this.getConnectionProfile();
			}

			// We haven't connected yet so do so now and then store the ID for the active connection
			if (!this._activeConnectionId) {
				const result = await azdata.connection.connect(this._connectionProfile!, false, false);
				if (!result.connected) {
					throw new Error(result.errorMessage);
				}
				this._activeConnectionId = result.connectionId;
			}

			// TODO Need to make separate calls for worker nodes and coordinator node
			const provider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(this._connectionProfile!.providerName, azdata.DataProviderType.QueryProvider);
			const ownerUri = await azdata.connection.getUriForConnection(this._activeConnectionId);

			const skippedEngineSettings: String[] = [
				'archive_command', 'archive_timeout', 'log_directory', 'log_file_mode', 'log_filename', 'restore_command',
				'shared_preload_libraries', 'synchronous_commit', 'ssl', 'unix_socket_permissions', 'wal_level'
			];

			await this.createCoordinatorEngineSettings(provider, ownerUri, skippedEngineSettings);

			const scale = this._config?.spec.scale;
			const nodes = (scale?.workers ?? scale?.shards ?? 0);
			if (nodes !== 0) {
				await this.createWorkerEngineSettings(provider, ownerUri, skippedEngineSettings);
			}

			this.engineSettingsLastUpdated = new Date();
			this._engineSettingsPromise.resolve();
		} catch (err) {
			this._engineSettingsPromise.reject(err);
			throw err;
		} finally {
			this._engineSettingsPromise = undefined;
		}
	}

	private async createCoordinatorEngineSettings(provider: azdata.QueryProvider, ownerUri: string, skip: String[]): Promise<void> {
		const engineSettingsCoordinator = await provider.runQueryAndReturn(ownerUri, 'select name, setting, short_desc,min_val, max_val, enumvals, vartype from pg_settings');

		this.coordinatorNodeEngineSettings = [];
		engineSettingsCoordinator.rows.forEach(row => {
			let rowValues = row.map(c => c.displayValue);
			let name = rowValues.shift();
			if (!skip.includes(name!)) {
				let result: EngineSettingsModel = {
					parameterName: name,
					value: rowValues.shift(),
					description: rowValues.shift(),
					min: rowValues.shift(),
					max: rowValues.shift(),
					options: rowValues.shift(),
					type: rowValues.shift()
				};

				this.coordinatorNodeEngineSettings.push(result);
			}
		});

	}

	private async createWorkerEngineSettings(provider: azdata.QueryProvider, ownerUri: string, skip: String[]): Promise<void> {

		const engineSettingsWorker = await provider.runQueryAndReturn(ownerUri,
			`with settings as (select nodename, success, result from run_command_on_workers('select json_agg(pg_settings) from pg_settings') order by success desc, nodename asc)
			select * from settings limit case when exists(select 1 from settings where success) then 1 end`);

		if (engineSettingsWorker.rows[0][1].displayValue === 'False') {
			let errorString = engineSettingsWorker.rows.map(row => row[2].displayValue);
			throw new Error(errorString.join('\n'));
		}

		let engineSettingsWorkerJSON = JSON.parse(engineSettingsWorker.rows[0][2].displayValue);
		this.workerNodesEngineSettings = [];

		for (let i = 0; i < engineSettingsWorkerJSON.length; i++) {
			let rowValues = engineSettingsWorkerJSON[i];
			let name = rowValues.name;
			if (!skip.includes(name!)) {
				let result: EngineSettingsModel = {
					parameterName: name,
					value: rowValues.setting,
					description: rowValues.short_desc,
					min: rowValues.min_val,
					max: rowValues.max_val,
					options: rowValues.enumvals,
					type: rowValues.vartype
				};

				this.workerNodesEngineSettings.push(result);
			}
		}

	}

	protected createConnectionProfile(): azdata.IConnectionProfile {
		const ipAndPort = parseIpAndPort(this.config?.status.primaryEndpoint || '');
		return {
			serverName: `${ipAndPort.ip},${ipAndPort.port}`,
			databaseName: '',
			authenticationType: 'SqlLogin',
			providerName: loc.postgresProviderName,
			connectionName: '',
			userName: this._pgInfo.userName || '',
			password: '',
			savePassword: true,
			groupFullName: undefined,
			saveProfile: true,
			id: '',
			groupId: undefined,
			options: {
				host: `${ipAndPort.ip}`,
				port: `${ipAndPort.port}`,
			}
		};
	}

	protected async promptForConnection(connectionProfile: azdata.IConnectionProfile): Promise<void> {
		const connectToSqlDialog = new ConnectToPGSqlDialog(this.controllerModel, this);
		connectToSqlDialog.showDialog(loc.connectToPGSql(this.info.name), connectionProfile);
		let profileFromDialog = await connectToSqlDialog.waitForClose();

		if (profileFromDialog) {
			this.updateConnectionProfile(profileFromDialog);
		} else {
			throw new UserCancelledError();
		}
	}

	protected async updateConnectionProfile(connectionProfile: azdata.IConnectionProfile): Promise<void> {
		this._connectionProfile = connectionProfile;
		this.info.connectionId = connectionProfile.id;
		this._pgInfo.userName = connectionProfile.userName;
		await this._treeDataProvider.saveControllers();
	}
}
