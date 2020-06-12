/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as loc from '../localizedConstants';
import { DuskyObjectModelsDatabaseService, DatabaseRouterApi, DuskyObjectModelsDatabase, V1Status } from '../controller/generated/dusky/api';
import { Authentication } from '../controller/auth';

export class PostgresModel {
	private _databaseRouter: DatabaseRouterApi;
	private _service?: DuskyObjectModelsDatabaseService;
	private _password?: string;
	private readonly _onServiceUpdated = new vscode.EventEmitter<DuskyObjectModelsDatabaseService>();
	private readonly _onPasswordUpdated = new vscode.EventEmitter<string>();
	public onServiceUpdated = this._onServiceUpdated.event;
	public onPasswordUpdated = this._onPasswordUpdated.event;
	public serviceLastUpdated?: Date;
	public passwordLastUpdated?: Date;

	constructor(controllerUrl: string, auth: Authentication, private _namespace: string, private _name: string) {
		this._databaseRouter = new DatabaseRouterApi(controllerUrl);
		this._databaseRouter.setDefaultAuthentication(auth);
	}

	/** Returns the service's Kubernetes namespace */
	public get namespace(): string {
		return this._namespace;
	}

	/** Returns the service's name */
	public get name(): string {
		return this._name;
	}

	/** Returns the service's fully qualified name in the format namespace.name */
	public get fullName(): string {
		return `${this._namespace}.${this._name}`;
	}

	/** Returns the service's spec */
	public get service(): DuskyObjectModelsDatabaseService | undefined {
		return this._service;
	}

	/** Returns the service's password */
	public get password(): string | undefined {
		return this._password;
	}

	/** Refreshes the model */
	public async refresh() {
		await Promise.all([
			this._databaseRouter.getDuskyDatabaseService(this._namespace, this._name).then(response => {
				this._service = response.body;
				this.serviceLastUpdated = new Date();
				this._onServiceUpdated.fire(this._service);
			}),
			this._databaseRouter.getDuskyPassword(this._namespace, this._name).then(async response => {
				this._password = response.body;
				this.passwordLastUpdated = new Date();
				this._onPasswordUpdated.fire(this._password!);
			})
		]);
	}

	/**
	 * Updates the service
	 * @param func A function of modifications to apply to the service
	 */
	public async update(func: (service: DuskyObjectModelsDatabaseService) => void): Promise<DuskyObjectModelsDatabaseService> {
		// Get the latest spec of the service in case it has changed
		const service = (await this._databaseRouter.getDuskyDatabaseService(this._namespace, this._name)).body;
		service.status = undefined; // can't update the status
		func(service);

		return await this._databaseRouter.updateDuskyDatabaseService(this.namespace, this.name, service).then(r => {
			this._service = r.body;
			return this._service;
		});
	}

	/** Deletes the service */
	public async delete(): Promise<V1Status> {
		return (await this._databaseRouter.deleteDuskyDatabaseService(this._namespace, this._name)).body;
	}

	/** Creates a SQL database in the service */
	public async createDatabase(db: DuskyObjectModelsDatabase): Promise<DuskyObjectModelsDatabase> {
		return (await this._databaseRouter.createDuskyDatabase(this.namespace, this.name, db)).body;
	}

	/** Returns the number of nodes in the service */
	public get numNodes(): number {
		let nodes = this._service?.spec.scale?.shards ?? 1;
		if (nodes > 1) { nodes++; } // for multiple shards there is an additional node for the coordinator
		return nodes;
	}

	/**
	 * Returns the IP address and port of the service, preferring external IP over
	 * internal IP. If either field is not available it will be set to undefined.
	 */
	public get endpoint(): { ip?: string, port?: number } {
		const externalIp = this._service?.status?.externalIP;
		const internalIp = this._service?.status?.internalIP;
		const externalPort = this._service?.status?.externalPort;
		const internalPort = this._service?.status?.internalPort;

		return externalIp ? { ip: externalIp, port: externalPort ?? undefined }
			: internalIp ? { ip: internalIp, port: internalPort ?? undefined }
				: { ip: undefined, port: undefined };
	}

	/** Returns the service's configuration e.g. '3 nodes, 1.5 vCores, 1GiB RAM, 2GiB storage per node' */
	public get configuration(): string {
		const nodes = this.numNodes;
		const cpuLimit = this._service?.spec.scheduling?.resources?.limits?.['cpu'];
		const ramLimit = this._service?.spec.scheduling?.resources?.limits?.['memory'];
		const cpuRequest = this._service?.spec.scheduling?.resources?.requests?.['cpu'];
		const ramRequest = this._service?.spec.scheduling?.resources?.requests?.['memory'];
		const storage = this._service?.spec.storage.volumeSize;

		// Prefer limits if they're provided, otherwise use requests if they're provided
		let configuration = `${nodes} ${nodes > 1 ? loc.nodes : loc.node}`;
		if (cpuLimit || cpuRequest) {
			configuration += `, ${this.formatCores(cpuLimit ?? cpuRequest!)} ${loc.vCores}`;
		}
		if (ramLimit || ramRequest) {
			configuration += `, ${this.formatMemory(ramLimit ?? ramRequest!)} ${loc.ram}`;
		}
		if (storage) { configuration += `, ${storage} ${loc.storagePerNode}`; }
		return configuration;
	}

	/**
	 * Converts millicores to cores (600m -> 0.6 cores)
	 * https://kubernetes.io/docs/concepts/configuration/manage-compute-resources-container/#meaning-of-cpu
	 * @param cores The millicores to format e.g. 600m
	 */
	private formatCores(cores: string): number {
		return cores?.endsWith('m') ? +cores.slice(0, -1) / 1000 : +cores;
	}

	/**
	 * Formats the memory to end with 'B' e.g:
	 * 1 -> 1B
	 * 1K -> 1KB, 1Ki -> 1KiB
	 * 1M -> 1MB, 1Mi -> 1MiB
	 * 1G -> 1GB, 1Gi -> 1GiB
	 * 1T -> 1TB, 1Ti -> 1TiB
	 * https://kubernetes.io/docs/concepts/configuration/manage-compute-resources-container/#meaning-of-memory
	 * @param memory The amount + unit of memory to format e.g. 1K
	 */
	private formatMemory(memory: string): string {
		return memory && !memory.endsWith('B') ? `${memory}B` : memory;
	}
}
