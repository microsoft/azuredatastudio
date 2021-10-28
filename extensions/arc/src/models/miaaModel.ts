/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MiaaResourceInfo } from 'arc';
import * as azdata from 'azdata';
import * as azExt from 'az-ext';
import * as vscode from 'vscode';
import { UserCancelledError } from '../common/api';
import { Deferred } from '../common/promise';
import { getTimeStamp, parseIpAndPort } from '../common/utils';
import * as loc from '../localizedConstants';
import { ConnectToMiaaSqlDialog } from '../ui/dialogs/connectMiaaDialog';
import { AzureArcTreeDataProvider } from '../ui/tree/azureArcTreeDataProvider';
import { ControllerModel, Registration } from './controllerModel';
import { ResourceModel } from './resourceModel';

export type DatabaseModel = { name: string, status: string, earliestBackup: string, lastBackup: string };
export type RPModel = { recoveryPointObjective: string, retentionDays: string };
export type PITRModel = {
	instanceName: string,
	resourceGroupName: string,
	location: string,
	subscriptionId: string,
	dbName: string,
	restorePoint: string,
	earliestPitr: string,
	latestPitr: string,
	destDbName: string
};

export const systemDbs = ['master', 'msdb', 'tempdb', 'model'];
export class MiaaModel extends ResourceModel {

	private _config: azExt.SqlMiShowResult | undefined;
	private _databases: DatabaseModel[] = [];
	private readonly _onConfigUpdated = new vscode.EventEmitter<azExt.SqlMiShowResult | undefined>();
	private readonly _onDatabasesUpdated = new vscode.EventEmitter<DatabaseModel[]>();
	private readonly _azApi: azExt.IExtension;
	public onConfigUpdated = this._onConfigUpdated.event;
	public onDatabasesUpdated = this._onDatabasesUpdated.event;
	public configLastUpdated: Date | undefined;
	public databasesLastUpdated: Date | undefined;
	public rpSettings: RPModel = {
		recoveryPointObjective: '',
		retentionDays: ''
	};
	private _databaseTimeWindow: Map<string, string[]>;

	private _refreshPromise: Deferred<void> | undefined = undefined;
	private _pitrArgs = {
		destName: '',
		managedInstance: '',
		time: '',
		noWait: true,
		dryRun: false
	};
	constructor(_controllerModel: ControllerModel, private _miaaInfo: MiaaResourceInfo, registration: Registration, private _treeDataProvider: AzureArcTreeDataProvider) {
		super(_controllerModel, _miaaInfo, registration);
		this._azApi = <azExt.IExtension>vscode.extensions.getExtension(azExt.extension.name)?.exports;
		this._databaseTimeWindow = new Map<string, string[]>();
	}

	/**
	 * The username used to connect to this instance
	 */
	public get username(): string | undefined {
		return this._connectionProfile?.userName;
	}

	/**
	 * The status of this instance
	 */
	public get config(): azExt.SqlMiShowResult | undefined {
		return this._config;
	}

	/**
	 * The cluster endpoint of this instance
	 */
	public get clusterEndpoint(): string {
		return ''; // TODO chgagnon
		// return this._config?.cluster_endpoint || '';
	}

	public get databases(): DatabaseModel[] {
		return this._databases;
	}

	/** Refreshes the model */
	public async refresh(): Promise<void> {
		// Only allow one refresh to be happening at a time
		if (this._refreshPromise) {
			return this._refreshPromise.promise;
		}
		this._refreshPromise = new Deferred();
		try {
			try {
				const result = await this._azApi.az.sql.miarc.show(this.info.name, this.controllerModel.info.namespace, this.controllerModel.azAdditionalEnvVars);
				this._config = result.stdout;
				this.configLastUpdated = new Date();
				this.rpSettings.retentionDays = this._config?.spec?.backup?.retentionPeriodInDays?.toString() ?? '';
				this._onConfigUpdated.fire(this._config);
				this._onDatabasesUpdated.fire(this._databases);
			} catch (err) {
				// If an error occurs show a message so the user knows something failed but still
				// fire the event so callers can know to update (e.g. so dashboards don't show the
				// loading icon forever)
				vscode.window.showErrorMessage(loc.fetchConfigFailed(this.info.name, err));
				this.configLastUpdated = new Date();
				this._onConfigUpdated.fire(undefined);
				throw err;
			}

			// If we have an external endpoint configured then fetch the databases now
			if (this._config.status.primaryEndpoint) {
				this.getDatabases(false).catch(_err => {
					// If an error occurs still fire the event so callers can know to
					// update (e.g. so dashboards don't show the loading icon forever)

					this.databasesLastUpdated = undefined;
					this._onDatabasesUpdated.fire(this._databases);
				});
			} else {
				// Otherwise just fire the event so dashboards can update appropriately
				this.databasesLastUpdated = undefined;
				this._onDatabasesUpdated.fire(this._databases);
			}

			this._refreshPromise.resolve();
		} catch (err) {
			this._refreshPromise.reject(err);
			throw err;
		} finally {
			this._refreshPromise = undefined;
		}
	}

	public async callGetDatabases(): Promise<void> {
		try {
			await this.getDatabases();
		} catch (error) {
			if (error instanceof UserCancelledError) {
				vscode.window.showWarningMessage(loc.miaaConnectionRequired);
			} else {
				vscode.window.showErrorMessage(loc.fetchDatabasesFailed(this.info.name, error));
			}
			throw error;
		}
	}
	public async getDatabases(promptForConnection: boolean = true): Promise<void> {
		if (!this._connectionProfile) {
			await this.getConnectionProfile(promptForConnection);
		}

		// We haven't connected yet so do so now and then store the ID for the active connection
		if (!this._activeConnectionId) {
			const result = await azdata.connection.connect(this._connectionProfile!, false, false);
			if (!result.connected) {
				throw new Error(result.errorMessage);
			}
			this._activeConnectionId = result.connectionId;
		}

		const provider = azdata.dataprotocol.getProvider<azdata.MetadataProvider>(this._connectionProfile!.providerName, azdata.DataProviderType.MetadataProvider);
		const ownerUri = await azdata.connection.getUriForConnection(this._activeConnectionId);
		const databases = await provider.getDatabases(ownerUri);
		if (!databases) {
			throw new Error('Could not fetch databases');
		}
		else {
			if (databases.length > 0 && typeof (databases[0]) === 'object') {
				await Promise.all([(<azdata.DatabaseInfo[]>databases).forEach(async di => {
					await this.executeDryRun(<string>di.options['name']).then((result: string[]) => {
						let dm: DatabaseModel = {
							name: di.options['name'], status: di.options['state'], earliestBackup: result?.[0] ?? '',
							lastBackup: result?.[1] ?? ''
						};
						this._databases.push(dm);
					}).catch();//ignore
				})]).then(() =>
					this._databases.forEach(d => { this._databaseTimeWindow.set(d.name, [d.earliestBackup, d.lastBackup]); })
				);
			}
			else {
				this._databases = (<string[]>databases).map(db => { return { name: db, status: '-', earliestBackup: '', lastBackup: '' }; });
			}
		}
		this.databasesLastUpdated = new Date();
		this._onDatabasesUpdated.fire(this._databases);
	}

	protected createConnectionProfile(): azdata.IConnectionProfile {
		const ipAndPort = parseIpAndPort(this.config?.status.primaryEndpoint || '');
		return {
			serverName: `${ipAndPort.ip},${ipAndPort.port}`,
			databaseName: '',
			authenticationType: 'SqlLogin',
			providerName: loc.miaaProviderName,
			connectionName: '',
			userName: this._miaaInfo.userName || '',
			password: '',
			savePassword: true,
			groupFullName: undefined,
			saveProfile: true,
			id: '',
			groupId: undefined,
			options: {}
		};
	}

	protected async promptForConnection(connectionProfile: azdata.IConnectionProfile): Promise<void> {
		const connectToSqlDialog = new ConnectToMiaaSqlDialog(this.controllerModel, this);
		connectToSqlDialog.showDialog(loc.connectToMSSql(this.info.name), connectionProfile);
		let profileFromDialog = await connectToSqlDialog.waitForClose();

		if (profileFromDialog) {
			this.updateConnectionProfile(profileFromDialog);
		} else {
			throw new UserCancelledError();
		}
	}

	protected async updateConnectionProfile(connectionProfile: azdata.IConnectionProfile): Promise<void> {
		this._connectionProfile = connectionProfile;
		this._activeConnectionId = connectionProfile.id;
		this.info.connectionId = connectionProfile.id;
		this._miaaInfo.userName = connectionProfile.userName;
		await this._treeDataProvider.saveControllers();
	}

	protected async executeDryRun(dbName: string): Promise<string[]> {
		// Allow next dry Run to be executed only after 5(300000 ms ) minutes from current time as the log backups are
		// generated only at 5 minutes interval
		if ((systemDbs.indexOf(dbName) === -1) && (Date.now() - getTimeStamp(this._databaseTimeWindow.get(dbName)?.[1]) >= 300000)) {
			try {
				//Execute dryRun for earliestTime and save latest time as well so there is one call to az cli
				this._pitrArgs.destName = dbName + '-' + Date.now().toString();
				this._pitrArgs.managedInstance = this.info.name;
				this._pitrArgs.time = new Date().toISOString();
				this._pitrArgs.noWait = false;
				this._pitrArgs.dryRun = true;
				let result = await this._azApi.az.sql.midbarc.restore(
					dbName, this._pitrArgs, this.controllerModel.info.namespace, this.controllerModel.azAdditionalEnvVars);
				let restoreResult = result.stdout;
				if (restoreResult) {
					let earliestTime = restoreResult['earliestRestoreTime'];
					let latestTime = restoreResult['latestRestoreTime'];
					console.log(loc.earliestPitrRestorePoint + '-' + dbName + ':' + earliestTime);
					console.log(loc.latestpitrRestorePoint + '-' + dbName + ':' + latestTime);
					//this._databaseTimeWindow.set(dbName, [earliestTime, latestTime]);
					return [earliestTime, latestTime];
				}
				return [this._databaseTimeWindow.get(dbName)?.[0] ?? '', this._databaseTimeWindow.get(dbName)?.[1] ?? ''];
			}
			catch (err) {
				console.log(err);
				//this._databaseTimeWindow.set(dbName, ['', '']);
				return ['', ''];
			}

		}
		return [this._databaseTimeWindow.get(dbName)?.[0] ?? '', this._databaseTimeWindow.get(dbName)?.[1] ?? ''];
	}
}


