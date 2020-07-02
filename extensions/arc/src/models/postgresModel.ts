/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as loc from '../localizedConstants';
import { DuskyObjectModelsDatabaseService, DatabaseRouterApi, DuskyObjectModelsDatabase, V1Status, V1Pod } from '../controller/generated/dusky/api';
import { Authentication } from '../controller/auth';
import { ResourceInfo, Registration } from './controllerModel';
import { ResourceModel } from './resourceModel';

export enum PodRole {
	Monitor,
	Router,
	Shard
}

export class PostgresModel extends ResourceModel {
	private _databaseRouter: DatabaseRouterApi;
	private _service?: DuskyObjectModelsDatabaseService;
	private _pods?: V1Pod[];
	private readonly _onServiceUpdated = new vscode.EventEmitter<DuskyObjectModelsDatabaseService>();
	private readonly _onPodsUpdated = new vscode.EventEmitter<V1Pod[]>();
	public onServiceUpdated = this._onServiceUpdated.event;
	public onPodsUpdated = this._onPodsUpdated.event;
	public serviceLastUpdated?: Date;
	public podsLastUpdated?: Date;

	constructor(controllerUrl: string, auth: Authentication, info: ResourceInfo, registration: Registration) {
		super(info, registration);
		this._databaseRouter = new DatabaseRouterApi(controllerUrl);
		this._databaseRouter.setDefaultAuthentication(auth);
	}

	/** Returns the service's Kubernetes namespace */
	public get namespace(): string {
		return this.info.namespace;
	}

	/** Returns the service's name */
	public get name(): string {
		return this.info.name;
	}

	/** Returns the service's fully qualified name in the format namespace.name */
	public get fullName(): string {
		return `${this.info.namespace}.${this.info.name}`;
	}

	/** Returns the service's spec */
	public get service(): DuskyObjectModelsDatabaseService | undefined {
		return this._service;
	}

	/** Returns the service's pods */
	public get pods(): V1Pod[] | undefined {
		return this._pods;
	}

	/** Refreshes the model */
	public async refresh() {
		await Promise.all([
			this._databaseRouter.getDuskyDatabaseService(this.info.namespace, this.info.name).then(response => {
				this._service = response.body;
				this.serviceLastUpdated = new Date();
				this._onServiceUpdated.fire(this._service);
			}),
			this._databaseRouter.getDuskyPods(this.info.namespace, this.info.name).then(response => {
				this._pods = response.body;
				this.podsLastUpdated = new Date();
				this._onPodsUpdated.fire(this._pods!);
			})
		]);
	}

	/**
	 * Updates the service
	 * @param func A function of modifications to apply to the service
	 */
	public async update(func: (service: DuskyObjectModelsDatabaseService) => void): Promise<DuskyObjectModelsDatabaseService> {
		// Get the latest spec of the service in case it has changed
		const service = (await this._databaseRouter.getDuskyDatabaseService(this.info.namespace, this.info.name)).body;
		service.status = undefined; // can't update the status
		func(service);

		return await this._databaseRouter.updateDuskyDatabaseService(this.namespace, this.name, service).then(r => {
			this._service = r.body;
			return this._service;
		});
	}

	/** Deletes the service */
	public async delete(): Promise<V1Status> {
		return (await this._databaseRouter.deleteDuskyDatabaseService(this.info.namespace, this.info.name)).body;
	}

	/** Creates a SQL database in the service */
	public async createDatabase(db: DuskyObjectModelsDatabase): Promise<DuskyObjectModelsDatabase> {
		return (await this._databaseRouter.createDuskyDatabase(this.namespace, this.name, db)).body;
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

		// TODO: Resource requests and limits can be configured per role. Figure out how
		//       to display that in the UI. For now, only show the default configuration.
		const cpuLimit = this._service?.spec?.scheduling?._default?.resources?.limits?.['cpu'];
		const ramLimit = this._service?.spec?.scheduling?._default?.resources?.limits?.['memory'];
		const cpuRequest = this._service?.spec?.scheduling?._default?.resources?.requests?.['cpu'];
		const ramRequest = this._service?.spec?.scheduling?._default?.resources?.requests?.['memory'];
		const storage = this._service?.spec?.storage?.volumeSize;
		const nodes = this.pods?.length;

		let configuration: string[] = [];

		if (nodes) {
			configuration.push(`${nodes} ${nodes > 1 ? loc.nodes : loc.node}`);
		}

		// Prefer limits if they're provided, otherwise use requests if they're provided
		if (cpuLimit || cpuRequest) {
			configuration.push(`${this.formatCores(cpuLimit ?? cpuRequest!)} ${loc.vCores}`);
		}

		if (ramLimit || ramRequest) {
			configuration.push(`${this.formatMemory(ramLimit ?? ramRequest!)} ${loc.ram}`);
		}

		if (storage) {
			configuration.push(`${this.formatMemory(storage)} ${loc.storagePerNode}`);
		}

		return configuration.join(', ');
	}

	/** Given a V1Pod, returns its PodRole or undefined if the role isn't known */
	public static getPodRole(pod: V1Pod): PodRole | undefined {
		const name = pod.metadata?.name;
		const role = name?.substring(name.lastIndexOf('-'))[1];
		switch (role) {
			case 'm': return PodRole.Monitor;
			case 'r': return PodRole.Router;
			case 's': return PodRole.Shard;
			default: return undefined;
		}
	}

	/** Given a PodRole, returns its localized name */
	public static getPodRoleName(role?: PodRole): string {
		switch (role) {
			case PodRole.Monitor: return loc.monitor;
			case PodRole.Router: return loc.coordinator;
			case PodRole.Shard: return loc.worker;
			default: return '';
		}
	}

	/** Given a V1Pod returns its status */
	public static getPodStatus(pod: V1Pod): string {
		const phase = pod.status?.phase;
		if (phase !== 'Running') {
			return phase ?? '';
		}

		// Pods can be in the running phase while some
		// containers are crashing, so check those too.
		for (let c of pod.status?.containerStatuses?.filter(c => !c.ready) ?? []) {
			const wReason = c.state?.waiting?.reason;
			const tReason = c.state?.terminated?.reason;
			if (wReason) { return wReason; }
			if (tReason) { return tReason; }
		}

		return loc.running;
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
