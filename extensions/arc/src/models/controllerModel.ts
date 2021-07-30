/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ControllerInfo, ResourceType } from 'arc';
import * as azExt from 'az-ext';
import * as vscode from 'vscode';
import * as loc from '../localizedConstants';
import { AzureArcTreeDataProvider } from '../ui/tree/azureArcTreeDataProvider';

export type Registration = {
	instanceName: string,
	state: string,
	instanceType: ResourceType,
};

export class ControllerModel {
	private readonly _azApi: azExt.IExtension;
	private _endpoints: azExt.DcEndpointListResult[] = [];
	private _registrations: Registration[] = [];
	private _controllerConfig: azExt.DcConfigShowResult | undefined = undefined;

	private readonly _onConfigUpdated = new vscode.EventEmitter<azExt.DcConfigShowResult | undefined>();
	private readonly _onEndpointsUpdated = new vscode.EventEmitter<azExt.DcEndpointListResult[]>();
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
		this._azApi = <azExt.IExtension>vscode.extensions.getExtension(azExt.extension.name)?.exports;
	}

	public get info(): ControllerInfo {
		return this._info;
	}

	public set info(value: ControllerInfo) {
		this._info = value;
		this._onInfoUpdated.fire(this._info);
	}

	public get azAdditionalEnvVars(): azExt.AdditionalEnvVars {
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
			await this.refresh(false, this.info.namespace);
		}
	}
	public async refresh(showErrors: boolean = true, namespace: string): Promise<void> {
		const newRegistrations: Registration[] = [];
		await Promise.all([
			this._azApi.az.arcdata.dc.config.show(namespace, this.azAdditionalEnvVars).then(result => {
				this._controllerConfig = result.stdout;
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
			this._azApi.az.arcdata.dc.endpoint.list(namespace, this.azAdditionalEnvVars).then(result => {
				this._endpoints = result.stdout;
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
				this._azApi.az.postgres.arcserver.list(namespace, this.azAdditionalEnvVars).then(result => {
					newRegistrations.push(...result.stdout.map(r => {
						return {
							instanceName: r.name,
							state: r.state,
							instanceType: ResourceType.postgresInstances
						};
					}));
				}),
				this._azApi.az.sql.miarc.list(namespace, this.azAdditionalEnvVars).then(result => {
					newRegistrations.push(...result.stdout.map(r => {
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

	public get endpoints(): azExt.DcEndpointListResult[] {
		return this._endpoints;
	}

	public getEndpoint(name: string): azExt.DcEndpointListResult | undefined {
		return this._endpoints.find(e => e.name === name);
	}

	public get registrations(): Registration[] {
		return this._registrations;
	}

	public get controllerConfig(): azExt.DcConfigShowResult | undefined {
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
		return `${this.info.name}`;
	}
}
