/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceInfo } from 'arc';
import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import * as loc from '../localizedConstants';
import { ControllerModel, Registration } from './controllerModel';
import { ResourceModel } from './resourceModel';
import { parseIpAndPort } from '../common/utils';

export class PostgresModel extends ResourceModel {
	private _config?: azdataExt.PostgresServerShowResult;
	private readonly _azdataApi: azdataExt.IExtension;

	private readonly _onConfigUpdated = new vscode.EventEmitter<azdataExt.PostgresServerShowResult>();
	public onConfigUpdated = this._onConfigUpdated.event;
	public configLastUpdated?: Date;

	constructor(private _controllerModel: ControllerModel, info: ResourceInfo, registration: Registration) {
		super(info, registration);
		this._azdataApi = <azdataExt.IExtension>vscode.extensions.getExtension(azdataExt.extension.name)?.exports;
	}

	/** Returns the configuration of Postgres */
	public get config(): azdataExt.PostgresServerShowResult | undefined {
		return this._config;
	}

	/** Returns the major version of Postgres */
	public get engineVersion(): string | undefined {
		const kind = this._config?.kind;
		return kind
			? kind.substring(kind.lastIndexOf('-') + 1)
			: undefined;
	}

	/** Returns the IP address and port of Postgres */
	public get endpoint(): { ip: string, port: string } | undefined {
		return this._config?.status.externalEndpoint
			? parseIpAndPort(this._config.status.externalEndpoint)
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
		const storage = this._config.spec.storage?.data?.size;
		const nodes = (this._config.spec.scale?.shards ?? 0) + 1; // An extra node for the coordinator

		let configuration: string[] = [];
		configuration.push(`${nodes} ${nodes > 1 ? loc.nodes : loc.node}`);

		// Prefer limits if they're provided, otherwise use requests if they're provided
		if (cpuLimit || cpuRequest) {
			configuration.push(`${cpuLimit ?? cpuRequest!} ${loc.vCores}`);
		}

		if (ramLimit || ramRequest) {
			configuration.push(`${ramLimit ?? ramRequest!} ${loc.ram}`);
		}

		if (storage) {
			configuration.push(`${storage} ${loc.storagePerNode}`);
		}

		return configuration.join(', ');
	}

	/** Refreshes the model */
	public async refresh() {
		await this._controllerModel.azdataLogin();
		this._config = (await this._azdataApi.azdata.arc.postgres.server.show(this.info.name)).result;
		this.configLastUpdated = new Date();
		this._onConfigUpdated.fire(this._config);
	}
}
