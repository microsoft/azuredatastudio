/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Authentication, BasicAuth } from '../controller/auth';
import { EndpointsRouterApi, EndpointModel, RegistrationRouterApi, RegistrationResponse, TokenRouterApi, SqlInstanceRouterApi } from '../controller/generated/v1/api';
import { getAzurecoreApi, parseEndpoint, parseInstanceName, UserCancelledError } from '../common/utils';
import { ResourceType } from '../constants';
import { ConnectToControllerDialog } from '../ui/dialogs/connectControllerDialog';
import { AzureArcTreeDataProvider } from '../ui/tree/azureArcTreeDataProvider';
import * as loc from '../localizedConstants';

export type ControllerInfo = {
	url: string,
	name: string,
	username: string,
	rememberPassword: boolean,
	resources: ResourceInfo[]
};

export type ResourceInfo = {
	namespace: string,
	name: string,
	resourceType: ResourceType | string,
	connectionId?: string
};

export interface Registration extends RegistrationResponse {
	externalIp?: string;
	externalPort?: string;
	region?: string
}

export class ControllerModel {
	private _endpointsRouter: EndpointsRouterApi;
	private _tokenRouter: TokenRouterApi;
	private _registrationRouter: RegistrationRouterApi;
	private _sqlInstanceRouter: SqlInstanceRouterApi;
	private _endpoints: EndpointModel[] = [];
	private _namespace: string = '';
	private _registrations: Registration[] = [];
	private _controllerRegistration: Registration | undefined = undefined;
	private _auth: Authentication | undefined = undefined;

	private readonly _onEndpointsUpdated = new vscode.EventEmitter<EndpointModel[]>();
	private readonly _onRegistrationsUpdated = new vscode.EventEmitter<Registration[]>();
	public onEndpointsUpdated = this._onEndpointsUpdated.event;
	public onRegistrationsUpdated = this._onRegistrationsUpdated.event;
	public endpointsLastUpdated?: Date;
	public registrationsLastUpdated?: Date;
	public get auth(): Authentication | undefined {
		return this._auth;
	}

	constructor(public treeDataProvider: AzureArcTreeDataProvider, public info: ControllerInfo, password?: string) {
		this._endpointsRouter = new EndpointsRouterApi(this.info.url);
		this._tokenRouter = new TokenRouterApi(this.info.url);
		this._registrationRouter = new RegistrationRouterApi(this.info.url);
		this._sqlInstanceRouter = new SqlInstanceRouterApi(this.info.url);
		if (password) {
			this.setAuthentication(new BasicAuth(this.info.username, password));
		}
	}

	public async refresh(showErrors: boolean = true, promptReconnect: boolean = false): Promise<void> {
		// We haven't gotten our password yet or we want to prompt for a reconnect
		if (!this._auth || promptReconnect) {
			let password = '';
			if (this.info.rememberPassword) {
				// It should be in the credentials store, get it from there
				password = await this.treeDataProvider.getPassword(this.info);
			}
			if (password && !promptReconnect) {
				this.setAuthentication(new BasicAuth(this.info.username, password));
			} else {
				// No password yet or we want to re-prompt for credentials so prompt for it from the user
				const dialog = new ConnectToControllerDialog(this.treeDataProvider);
				dialog.showDialog(this.info, password);
				const model = await dialog.waitForClose();
				if (model) {
					this.treeDataProvider.addOrUpdateController(model.controllerModel, model.password, false);
					this.setAuthentication(new BasicAuth(this.info.username, model.password));
				} else {
					throw new UserCancelledError();
				}
			}

		}
		await Promise.all([
			this._endpointsRouter.apiV1BdcEndpointsGet().then(response => {
				this._endpoints = response.body;
				this.endpointsLastUpdated = new Date();
				this._onEndpointsUpdated.fire(this._endpoints);
			}).catch(err => {
				// If an error occurs show a message so the user knows something failed but still
				// fire the event so callers can know to update (e.g. so dashboards don't show the
				// loading icon forever)
				if (showErrors) {
					vscode.window.showErrorMessage(loc.fetchEndpointsFailed(this.info.url, err));
				}
				this._onEndpointsUpdated.fire(this._endpoints);
				throw err;
			}),
			this._tokenRouter.apiV1TokenPost().then(async response => {
				this._namespace = response.body.namespace!;
				const registrationResponse = await this._registrationRouter.apiV1RegistrationListResourcesNsGet(this._namespace);
				this._registrations = await Promise.all(registrationResponse.body.map(mapRegistrationResponse));

				this._controllerRegistration = this._registrations.find(r => r.instanceType === ResourceType.dataControllers);
				this.registrationsLastUpdated = new Date();
				this._onRegistrationsUpdated.fire(this._registrations);
			}).catch(err => {
				// If an error occurs show a message so the user knows something failed but still
				// fire the event so callers can know to update (e.g. so dashboards don't show the
				// loading icon forever)
				if (showErrors) {
					vscode.window.showErrorMessage(loc.fetchRegistrationsFailed(this.info.url, err));
				}
				this._onRegistrationsUpdated.fire(this._registrations);
				throw err;
			}),
		]);
	}

	public get endpoints(): EndpointModel[] {
		return this._endpoints;
	}

	public getEndpoint(name: string): EndpointModel | undefined {
		return this._endpoints.find(e => e.name === name);
	}

	public get namespace(): string {
		return this._namespace;
	}

	public get registrations(): Registration[] {
		return this._registrations;
	}

	public get controllerRegistration(): Registration | undefined {
		return this._controllerRegistration;
	}

	public getRegistration(type: ResourceType, namespace: string, name: string): Registration | undefined {
		return this._registrations.find(r => {
			return r.instanceType === type && r.instanceNamespace === namespace && parseInstanceName(r.instanceName) === name;
		});
	}

	public async deleteRegistration(type: ResourceType, namespace: string, name: string) {
		const r = this.getRegistration(type, namespace, name);
		if (r && !r.isDeleted && r.customObjectName) {
			await this._registrationRouter.apiV1RegistrationNsNameIsDeletedDelete(this._namespace, r.customObjectName, true);
		}
	}

	/**
	 * Deletes the specified MIAA resource from the controller
	 * @param namespace The namespace of the resource
	 * @param name The name of the resource
	 */
	public async miaaDelete(namespace: string, name: string): Promise<void> {
		await this._sqlInstanceRouter.apiV1HybridSqlNsNameDelete(namespace, name);
		await this.deleteRegistration(ResourceType.sqlManagedInstances, namespace, name);
	}

	/**
	 * Tests whether this model is for the same controller as another
	 * @param other The other instance to test
	 */
	public equals(other: ControllerModel): boolean {
		return this.info.url === other.info.url &&
			this.info.username === other.info.username;
	}

	private setAuthentication(auth: Authentication): void {
		this._auth = auth;
		this._endpointsRouter.setDefaultAuthentication(auth);
		this._tokenRouter.setDefaultAuthentication(auth);
		this._registrationRouter.setDefaultAuthentication(auth);
		this._sqlInstanceRouter.setDefaultAuthentication(auth);
	}

	/**
	 * property to for use a display label for this controller
	 */
	public get label(): string {
		return `${this.info.name} (${this.info.url})`;
	}
}

/**
 * Maps a RegistrationResponse to a Registration,
 * @param response The RegistrationResponse to map
 */
async function mapRegistrationResponse(response: RegistrationResponse): Promise<Registration> {
	const parsedEndpoint = parseEndpoint(response.externalEndpoint);
	return {
		...response,
		externalIp: parsedEndpoint.ip,
		externalPort: parsedEndpoint.port,
		region: (await getAzurecoreApi()).getRegionDisplayName(response.location)
	};
}
