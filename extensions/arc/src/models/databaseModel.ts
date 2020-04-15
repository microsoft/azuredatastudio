/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DuskyObjectModelsDatabaseService, DatabaseRouterApi, DuskyObjectModelsDatabase, V1Status } from '../controller/generated/dusky/api';
import { Authentication } from '../controller/auth';

export class DatabaseModel {
	private _databaseRouter: DatabaseRouterApi;
	private _service: DuskyObjectModelsDatabaseService;

	constructor(controllerUrl: string, auth: Authentication, private _namespace: string, private _name: string) {
		this._databaseRouter = new DatabaseRouterApi(controllerUrl);
		this._databaseRouter.setDefaultAuthentication(auth);
	}

	public namespace(): string {
		return this._namespace;
	}

	public name(): string {
		return this._name;
	}

	public service(): DuskyObjectModelsDatabaseService {
		return this._service;
	}

	public async refresh() {
		this._service = (await this._databaseRouter.getDuskyDatabaseService(this._namespace, this._name)).body;
	}

	public async update(func: (service: DuskyObjectModelsDatabaseService) => void): Promise<void | DuskyObjectModelsDatabaseService> {
		// Get the latest spec of the service in case it has changed
		const service = (await this._databaseRouter.getDuskyDatabaseService(this._namespace, this._name)).body;
		service.status = undefined; // can't update the status
		func(service);

		return await this._databaseRouter.updateDuskyDatabaseService(this.namespace(), this.name(), service).then(r => {
			this._service = r.body;
			return this._service;
		});
	}

	public async delete(): Promise<V1Status> {
		return (await this._databaseRouter.deleteDuskyDatabaseService(this._namespace, this._name)).body;
	}

	public async createDatabase(db: DuskyObjectModelsDatabase): Promise<DuskyObjectModelsDatabase> {
		return await (await this._databaseRouter.createDuskyDatabase(this.namespace(), this.name(), db)).body;
	}

	public async password(): Promise<string> {
		return (await this._databaseRouter.getDuskyPassword(this._namespace, this._name)).body;
	}

	// Returns the number of nodes in the service
	public numNodes(): number {
		let nodes = this._service.spec.scale?.shards ?? 1;
		if (nodes > 1) { nodes++; } // for multiple shards there is an additional node for the coordinator
		return nodes;
	}

	// Returns the ip:port of the service
	public endpoint(): string {
		const externalIp = this._service.status.externalIP;
		const internalIp = this._service.status.internalIP;
		const externalPort = this._service.status.externalPort;
		const internalPort = this._service.status.internalPort;

		let ip = '0.0.0.0';
		if (externalIp) {
			ip = externalIp;
			if (externalPort) {
				ip += `:${externalPort}`;
			}
		} else if (internalIp) {
			ip = internalIp;
			if (internalPort) {
				ip += `:${internalPort}`;
			}
		}

		return ip;
	}

	// Returns the service's configuration e.g. '3 nodes, 1.5 vCores, 1GiB RAM, 2GiB storage per node'
	public configuration(): string {
		const nodes = this.numNodes();
		const cpuLimit = this.formatCores(this._service.spec.scheduling?.resources.limits?.['cpu']);
		const ramLimit = this.formatMemory(this._service.spec.scheduling?.resources.limits?.['memory']);
		const cpuRequest = this.formatCores(this._service.spec.scheduling?.resources.requests?.['cpu']);
		const ramRequest = this.formatMemory(this._service.spec.scheduling?.resources.requests?.['memory']);
		const storage = this.formatMemory(this._service.spec.storage.volumeSize);

		// Prefer limits if they're provided, otherwise use requests if they're provided
		let nodeConfiguration = `${nodes} node`;
		if (nodes > 1) { nodeConfiguration += 's'; }
		if (cpuLimit) {
			nodeConfiguration += `, ${cpuLimit} vCores`;
		} else if (cpuRequest) {
			nodeConfiguration += `, ${cpuRequest} vCores`;
		}
		if (ramLimit) {
			nodeConfiguration += `, ${ramLimit} RAM`;
		} else if (ramRequest) {
			nodeConfiguration += `, ${ramRequest} RAM`;
		}
		if (storage) { nodeConfiguration += `, ${storage} storage per node`; }
		return nodeConfiguration;
	}

	// Converts millicores to cores (600m -> 0.6 cores)
	// https://kubernetes.io/docs/concepts/configuration/manage-compute-resources-container/#meaning-of-cpu
	private formatCores(cores: string): number {
		return cores?.endsWith('m') ? +cores.slice(0, -1) / 1000 : +cores;
	}

	// Formats the memory to end with 'B' e.g:
	// 1 -> 1B
	// 1K -> 1KB, 1Ki -> 1KiB
	// 1M -> 1MB, 1Mi -> 1MiB
	// 1G -> 1GB, 1Gi -> 1GiB
	// 1T -> 1TB, 1Ti -> 1TiB
	// https://kubernetes.io/docs/concepts/configuration/manage-compute-resources-container/#meaning-of-memory
	private formatMemory(memory: string): string {
		return memory && !memory.endsWith('B') ? `${memory}B` : memory;
	}
}
