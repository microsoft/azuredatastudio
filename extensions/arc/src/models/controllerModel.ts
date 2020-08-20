/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { parseInstanceName, UserCancelledError } from '../common/utils';
import { ResourceType } from '../constants';
import { AzureArcTreeDataProvider } from '../ui/tree/azureArcTreeDataProvider';
import * as loc from '../localizedConstants';
import * as azdataExt from '../../../azdata/src/typings/azdata-ext';
import { ConnectToControllerDialog } from '../ui/dialogs/connectControllerDialog';

export type ControllerInfo = {
	url: string,
	name: string,
	username: string,
	rememberPassword: boolean,
	resources: ResourceInfo[]
};

export type ResourceInfo = {
	name: string,
	resourceType: ResourceType | string,
	namespace?: string,
	connectionId?: string
};

export type Registration = {
	instanceName: string,
	state: string,
	instanceType: ResourceType,
};

export class ControllerModel {
	private readonly _azdataApi: azdataExt.IExtension;
	private _endpoints: azdataExt.DcEndpointListResult[] = [];
	private _namespace: string = '';
	private _registrations: Registration[] = [];
	private _controllerConfig: azdataExt.DcConfigShowResult | undefined = undefined;

	private readonly _onConfigUpdated = new vscode.EventEmitter<azdataExt.DcConfigShowResult | undefined>();
	private readonly _onEndpointsUpdated = new vscode.EventEmitter<azdataExt.DcEndpointListResult[]>();
	private readonly _onRegistrationsUpdated = new vscode.EventEmitter<Registration[]>();

	public onConfigUpdated = this._onConfigUpdated.event;
	public onEndpointsUpdated = this._onEndpointsUpdated.event;
	public onRegistrationsUpdated = this._onRegistrationsUpdated.event;

	public configLastUpdated?: Date;
	public endpointsLastUpdated?: Date;
	public registrationsLastUpdated?: Date;

	constructor(public treeDataProvider: AzureArcTreeDataProvider, public info: ControllerInfo, private _password?: string) {
		this._azdataApi = <azdataExt.IExtension>vscode.extensions.getExtension(azdataExt.extension.name)?.exports;
	}

	public async refresh(showErrors: boolean = true, promptReconnect: boolean = false): Promise<void> {
		// We haven't gotten our password yet or we want to prompt for a reconnect
		if (!this._password || promptReconnect) {
			this._password = '';
			if (this.info.rememberPassword) {
				// It should be in the credentials store, get it from there
				this._password = await this.treeDataProvider.getPassword(this.info);
			}
			if (promptReconnect) {
				// No password yet or we want to re-prompt for credentials so prompt for it from the user
				const dialog = new ConnectToControllerDialog(this.treeDataProvider);
				dialog.showDialog(this.info, this._password);
				const model = await dialog.waitForClose();
				if (model) {
					this.treeDataProvider.addOrUpdateController(model.controllerModel, model.password, false);
				} else {
					throw new UserCancelledError();
				}
			}
		}

		await this._azdataApi.login(this.info.url, this.info.username, this._password);

		this._registrations = [];
		await Promise.all([
			this._azdataApi.dc.config.show().then(result => {
				this._controllerConfig = result.result;
				this.configLastUpdated = new Date();
				this._onConfigUpdated.fire(this._controllerConfig);
			}).catch(err => {
				// If an error occurs show a message so the user knows something failed but still
				// fire the event so callers can know to update (e.g. so dashboards don't show the
				// loading icon forever)
				if (showErrors) {
					vscode.window.showErrorMessage(loc.fetchConfigFailed(this.info.name, err));
				}
				this._onConfigUpdated.fire(this._controllerConfig);
				throw err;
			}),
			this._azdataApi.dc.endpoint.list().then(result => {
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
				this._azdataApi.postgres.server.list().then(result => {
					this._registrations.push(...result.result.map(r => {
						return {
							instanceName: r.name,
							state: r.state,
							instanceType: ResourceType.postgresInstances
						};
					}));
				}),
				this._azdataApi.sql.mi.list().then(result => {
					this._registrations.push(...result.result.map(r => {
						return {
							instanceName: r.name,
							state: r.state,
							instanceType: ResourceType.sqlManagedInstances
						};
					}));
				})
			]).then(() => {
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

	public get namespace(): string {
		return this._namespace;
	}

	public get registrations(): Registration[] {
		return this._registrations;
	}

	public get controllerConfig(): azdataExt.DcConfigShowResult | undefined {
		return this._controllerConfig;
	}

	public getRegistration(type: ResourceType, name: string): Registration | undefined {
		return this._registrations.find(r => {
			// TODO chgagnon namespace
			return r.instanceType === type && /* r.instanceNamespace === namespace && */ parseInstanceName(r.instanceName) === name;
		});
	}

	public async deleteRegistration(_type: ResourceType, _name: string) {
		/* TODO chgagnon
		if (r && !r.isDeleted && r.customObjectName) {
			const r = this.getRegistration(type, name);
			await this._registrationRouter.apiV1RegistrationNsNameIsDeletedDelete(this._namespace, r.customObjectName, true);
		}
		*/
	}

	/**
	 * Deletes the specified MIAA resource from the controller
	 * @param namespace The namespace of the resource
	 * @param name The name of the resource
	 */
	public async miaaDelete(name: string): Promise<void> {
		// TODO chgagnon Fix delete
		//await this._sqlInstanceRouter.apiV1HybridSqlNsNameDelete(namespace, name);
		await this.deleteRegistration(ResourceType.sqlManagedInstances, name);
	}

	/**
	 * Tests whether this model is for the same controller as another
	 * @param other The other instance to test
	 */
	public equals(other: ControllerModel): boolean {
		return this.info.url === other.info.url &&
			this.info.username === other.info.username;
	}

	/**
	 * property to for use a display label for this controller
	 */
	public get label(): string {
		return `${this.info.name} (${this.info.url})`;
	}
}
