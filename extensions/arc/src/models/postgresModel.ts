/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as loc from '../localizedConstants';
import { ResourceInfo, Registration } from './controllerModel';
import { ResourceModel } from './resourceModel';

export enum PodRole {
	Monitor,
	Router,
	Shard
}

export interface V1Pod {
	'apiVersion'?: string;
	'kind'?: string;
	'metadata'?: any; // V1ObjectMeta;
	'spec'?: any; // V1PodSpec;
	'status'?: V1PodStatus;
}

export interface V1PodStatus {
	'conditions'?: any[]; // Array<V1PodCondition>;
	'containerStatuses'?: Array<V1ContainerStatus>;
	'ephemeralContainerStatuses'?: any[]; // Array<V1ContainerStatus>;
	'hostIP'?: string;
	'initContainerStatuses'?: any[]; // Array<V1ContainerStatus>;
	'message'?: string;
	'nominatedNodeName'?: string;
	'phase'?: string;
	'podIP'?: string;
	'podIPs'?: any[]; // Array<V1PodIP>;
	'qosClass'?: string;
	'reason'?: string;
	'startTime'?: Date | null;
}

export interface V1ContainerStatus {
	'containerID'?: string;
	'image'?: string;
	'imageID'?: string;
	'lastState'?: any; // V1ContainerState;
	'name'?: string;
	'ready'?: boolean;
	'restartCount'?: number;
	'started'?: boolean | null;
	'state'?: any; // V1ContainerState;
}

export interface DuskyObjectModelsDatabaseService {
	'apiVersion'?: string;
	'kind'?: string;
	'metadata'?: any; // V1ObjectMeta;
	'spec'?: any; // DuskyObjectModelsDatabaseServiceSpec;
	'status'?: any; // DuskyObjectModelsDatabaseServiceStatus;
	'arc'?: any; // DuskyObjectModelsDatabaseServiceArcPayload;
}

export interface V1Status {
	'apiVersion'?: string;
	'code'?: number | null;
	'details'?: any; // V1StatusDetails;
	'kind'?: string;
	'message'?: string;
	'metadata'?: any; // V1ListMeta;
	'reason'?: string;
	'status'?: string;
	'hasObject'?: boolean;
}

export interface DuskyObjectModelsDatabase {
	'name'?: string;
	'owner'?: string;
	'sharded'?: boolean | null;
}

export class PostgresModel extends ResourceModel {
	private _service?: DuskyObjectModelsDatabaseService;
	private _pods?: V1Pod[];
	private readonly _onServiceUpdated = new vscode.EventEmitter<DuskyObjectModelsDatabaseService>();
	private readonly _onPodsUpdated = new vscode.EventEmitter<V1Pod[]>();
	public onServiceUpdated = this._onServiceUpdated.event;
	public onPodsUpdated = this._onPodsUpdated.event;
	public serviceLastUpdated?: Date;
	public podsLastUpdated?: Date;

	constructor(info: ResourceInfo, registration: Registration) {
		super(info, registration);
	}

	/** Returns the service's Kubernetes namespace */
	public get namespace(): string | undefined {
		return ''; // TODO chgagnon return this.info.namespace;
	}

	/** Returns the service's name */
	public get name(): string {
		return this.info.name;
	}

	/** Returns the service's fully qualified name in the format namespace.name */
	public get fullName(): string {
		return `${this.namespace}.${this.name}`;
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
			/* TODO enable
			this._databaseRouter.getDuskyDatabaseService(this.info.namespace || 'test', this.info.name).then(response => {
				this._service = response.body;
				this.serviceLastUpdated = new Date();
				this._onServiceUpdated.fire(this._service);
			}),
			this._databaseRouter.getDuskyPods(this.info.namespace || 'test', this.info.name).then(response => {
				this._pods = response.body;
				this.podsLastUpdated = new Date();
				this._onPodsUpdated.fire(this._pods!);
			})
			*/
		]);
	}

	/**
	 * Updates the service
	 * @param func A function of modifications to apply to the service
	 */
	public async update(_func: (service: DuskyObjectModelsDatabaseService) => void): Promise<DuskyObjectModelsDatabaseService> {
		return <any>undefined;
		/*
		// Get the latest spec of the service in case it has changed
		const service = (await this._databaseRouter.getDuskyDatabaseService(this.info.namespace || 'test', this.info.name)).body;
		service.status = undefined; // can't update the status
		func(service);

		return await this._databaseRouter.updateDuskyDatabaseService(this.namespace || 'test', this.name, service).then(r => {
			this._service = r.body;
			return this._service;
		});
		*/
	}

	/** Deletes the service */
	public async delete(): Promise<V1Status> {
		return <any>undefined;
		// return (await this._databaseRouter.deleteDuskyDatabaseService(this.info.namespace || 'test', this.info.name)).body;
	}

	/** Creates a SQL database in the service */
	public async createDatabase(_db: DuskyObjectModelsDatabase): Promise<DuskyObjectModelsDatabase> {
		return <any>undefined;
		// return (await this._databaseRouter.createDuskyDatabase(this.namespace || 'test', this.name, db)).body;
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
