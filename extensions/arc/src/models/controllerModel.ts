/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ControllerInfo, ResourceType } from 'arc';
import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import { UserCancelledError } from '../common/api';
import { getCurrentClusterContext, getKubeConfigClusterContexts } from '../common/kubeUtils';
import * as loc from '../localizedConstants';
import { ConnectToControllerDialog } from '../ui/dialogs/connectControllerDialog';
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

	constructor(public treeDataProvider: AzureArcTreeDataProvider, private _info: ControllerInfo, private _password?: string) {
		this._azdataApi = <azdataExt.IExtension>vscode.extensions.getExtension(azdataExt.extension.name)?.exports;
	}

	public get info(): ControllerInfo {
		return this._info;
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
	 * Calls azdata login to set the context to this controller and acquires a login session to prevent other
	 * calls from changing the context while commands for this session are being executed.
	 * @param promptReconnect
	 */
	public async acquireAzdataSession(promptReconnect: boolean = false): Promise<azdataExt.AzdataSession> {
		let promptForValidClusterContext: boolean = false;
		try {
			const contexts = await getKubeConfigClusterContexts(this.info.kubeConfigFilePath);
			getCurrentClusterContext(contexts, this.info.kubeClusterContext, true); // this throws if this.info.kubeClusterContext is not found in 'contexts'
		} catch (error) {
			const response = await vscode.window.showErrorMessage(loc.clusterContextConfigNoLongerValid(this.info.kubeConfigFilePath, this.info.kubeClusterContext, error), loc.yes, loc.no);
			if (response === loc.yes) {
				promptForValidClusterContext = true;
			} else {
				if (!promptReconnect) { //throw unless we are required to prompt for reconnect anyways
					throw error;
				}
			}
		}

		// We haven't gotten our password yet or we want to prompt for a reconnect or we want to prompt to reacquire valid cluster context or any and all of these.
		if (!this._password || promptReconnect || promptForValidClusterContext) {
			this._password = '';
			if (this.info.rememberPassword) {
				// It should be in the credentials store, get it from there
				this._password = await this.treeDataProvider.getPassword(this.info);
			}
			if (promptReconnect || !this._password || promptForValidClusterContext) {
				// No password yet or we want to re-prompt for credentials so prompt for it from the user
				const dialog = new ConnectToControllerDialog(this.treeDataProvider);
				dialog.showDialog(this.info, this._password);
				const model = await dialog.waitForClose();
				if (model) {
					await this.treeDataProvider.addOrUpdateController(model.controllerModel, model.password, false);
					this._password = model.password;
					this._info = model.controllerModel.info;
				} else {
					throw new UserCancelledError(loc.userCancelledError);
				}
			}
		}

		return this._azdataApi.azdata.acquireSession(this.info.url, this.info.username, this._password, this.azdataAdditionalEnvVars);
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
	public async refresh(showErrors: boolean = true, promptReconnect: boolean = false): Promise<void> {
		const session = await this.acquireAzdataSession(promptReconnect);
		const newRegistrations: Registration[] = [];
		try {
			await Promise.all([
				this._azdataApi.azdata.arc.dc.config.show(this.azdataAdditionalEnvVars, session).then(result => {
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
				this._azdataApi.azdata.arc.dc.endpoint.list(this.azdataAdditionalEnvVars, session).then(result => {
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
					this._azdataApi.azdata.arc.postgres.server.list(this.azdataAdditionalEnvVars, session).then(result => {
						newRegistrations.push(...result.result.map(r => {
							return {
								instanceName: r.name,
								state: r.state,
								instanceType: ResourceType.postgresInstances
							};
						}));
					}),
					this._azdataApi.azdata.arc.sql.mi.list(this.azdataAdditionalEnvVars, session).then(result => {
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
		} finally {
			session.dispose();
		}
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
		return `${this.info.name} (${this.info.url})`;
	}
}
