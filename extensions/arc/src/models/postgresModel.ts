/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceInfo } from 'arc';
import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
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

	public get config(): azdataExt.PostgresServerShowResult | undefined {
		return this._config;
	}

	/** Returns the IP address and port of the server */
	public get endpoint(): { ip: string, port: string } {
		return this._config
			? parseIpAndPort(this._config.status.externalEndpoint)
			: { ip: '', port: '' };
	}

	/** Returns the server's configuration e.g. '3 nodes, 1.5 vCores, 1GiB RAM, 2GiB storage per node' */
	public get configuration(): string {
		return ''; // TODO
	}

	/** Refreshes the model */
	public async refresh() {
		await this._controllerModel.azdataLogin();
		this._config = (await this._azdataApi.azdata.arc.postgres.server.show(this.info.name)).result;
		this.configLastUpdated = new Date();
		this._onConfigUpdated.fire(this._config);
	}
}
