/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ControllerInfo, ResourceType } from 'arc';
import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import * as loc from '../localizedConstants';
import { AzureArcTreeDataProvider } from '../ui/tree/azureArcTreeDataProvider';

export type Registration = {
	instanceName: string,
	state: string,
	instanceType: ResourceType,
};

export class ControllerModel {
	private readonly _azdataApi: azdataExt.IExtension;
	private _endpoints: azdataExt.DcEndpointListResult[] = [];
	private _registrations: Registration[] = [];
	private _controllerConfig: azdataExt.DcConfigShowResult | undefined = undefined;

	private readonly _onConfigUpdated = new vscode.EventEmitter<azdataExt.DcConfigShowResult | undefined>();
	private readonly _onEndpointsUpdated = new vscode.EventEmitter<azdataExt.DcEndpointListResult[]>();
	private readonly _onRegistrationsUpdated = new vscode.EventEmitter<Registration[]>();
	private readonly _onInfoUpdated = new vscode.EventEmitter<ControllerInfo>();

	public onConfigUpdated = this._onConfigUpdated.event;
	public onEndpointsUpdated = this._onEndpointsUpdated.event;
	public onRegistrationsUpdated = this._onRegistrationsUpdated.event;
	public onInfoUpdated = this._onInfoUpdated.event;

	public configLastUpdated?: Date;
	public endpointsLastUpdated?: Date;
	public registrationsLastUpdated?: Date;

	constructor(public treeDataProvider: AzureArcTreeDataProvider, private _info: ControllerInfo) {
		this._azdataApi = <azdataExt.IExtension>vscode.extensions.getExtension(azdataExt.extension.name)?.exports;
	}

	public get info(): ControllerInfo {
		return this._info;
	}

	/**
	 * Gets the controller context to use when executing azdata commands. This is in one of two forms :
	 *
	 * If no URL is specified for this controller then just the namespace is used (e.g. test-namespace)
	 * If a URL is specified then a 3-part name is used, combining the namespace, username and URL separated by
	 * / (e.g. test-namespace/admin/https://10.91.86.13:30080)
	 */
	public get controllerContext(): string {
		if (this._info.endpoint) {
			return `${this._info.namespace}/${this._info.username}/${this._info.endpoint}`;
		}
		return this._info.namespace;
	}

	public set info(value: ControllerInfo) {
		this._info = value;
		this._onInfoUpdated.fire(this._info);
	}

	public get azdataAdditionalEnvVars(): azdataExt.AdditionalEnvVars {
		return {
			'KUBECONFIG': this.info.kubeConfigFilePath,
			'KUBECTL_CONTEXT': this.info.kubeClusterContext
		};
	}

	/**
	 * Refreshes the Tree Node for this model. This will also result in the model being refreshed.
	 */
	public async refreshTreeNode(): Promise<void> {
		const node = this.treeDataProvider.getControllerNode(this);
		if (node) {
			this.treeDataProvider.refreshNode(node);
		} else {
			await this.refresh(false);
		}
	}
	public async refresh(showErrors: boolean = true): Promise<void> {
		// First need to log in to ensure that we're able to authenticate with the controller
		const newRegistrations: Registration[] = [];
		await Promise.all([
			this._azdataApi.azdata.arc.dc.config.show(this.azdataAdditionalEnvVars).then(result => {
				this._controllerConfig = result.result;
				this.configLastUpdated = new Date();
				this._onConfigUpdated.fire(this._controllerConfig);
			}).catch(err => {
				// If an error occurs show a message so the user knows something failed but still
				// fire the event so callers hooking into this can handle the error (e.g. so dashboards don't show the
				// loading icon forever)
				if (showErrors) {
					vscode.window.showErrorMessage(loc.fetchConfigFailed(this.info.name, err));
				}
				this._onConfigUpdated.fire(this._controllerConfig);
				throw err;
			}),
			this._azdataApi.azdata.arc.dc.endpoint.list(this.azdataAdditionalEnvVars).then(result => {
				this._endpoints = result.result;
				this.endpointsLastUpdated = new Date();
				this._onEndpointsUpdated.fire(this._endpoints);
			}).catch(err => {
				// If an error occurs show a message so the user knows something failed but still
				// fire the event so callers can know to update (e.g. so dashboards don't show the
				// loading icon forever)
				if (showErrors) {
					vscode.window.showErrorMessage(loc.fetchEndpointsFailed(this.info.name, err));
				}
				this._onEndpointsUpdated.fire(this._endpoints);
				throw err;
			}),
			Promise.all([
				this._azdataApi.azdata.arc.postgres.server.list(this.azdataAdditionalEnvVars).then(result => {
					newRegistrations.push(...result.result.map(r => {
						return {
							instanceName: r.name,
							state: r.state,
							instanceType: ResourceType.postgresInstances
						};
					}));
				}),
				this._azdataApi.azdata.arc.sql.mi.list(this.azdataAdditionalEnvVars).then(result => {
					newRegistrations.push(...result.result.map(r => {
						return {
							instanceName: r.name,
							state: r.state,
							instanceType: ResourceType.sqlManagedInstances
						};
					}));
				})
			]).then(() => {
				this._registrations = newRegistrations;
				this.registrationsLastUpdated = new Date();
				this._onRegistrationsUpdated.fire(this._registrations);
			})
		]);
	}

	public get endpoints(): azdataExt.DcEndpointListResult[] {
		return this._endpoints;
	}

	public getEndpoint(name: string): azdataExt.DcEndpointListResult | undefined {
		return this._endpoints.find(e => e.name === name);
	}

	public get registrations(): Registration[] {
		return this._registrations;
	}

	public get controllerConfig(): azdataExt.DcConfigShowResult | undefined {
		return this._controllerConfig;
	}

	public getRegistration(type: ResourceType, name: string): Registration | undefined {
		return this._registrations.find(r => {
			return r.instanceType === type && r.instanceName === name;
		});
	}

	/**
	 * property to for use a display label for this controller
	 */
	public get label(): string {
		return `${this.info.name} (${this.controllerContext})`;
	}
}
