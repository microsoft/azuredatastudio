/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Authentication } from '../controller/auth';
import { EndpointsRouterApi, EndpointModel, RegistrationRouterApi, RegistrationResponse, TokenRouterApi } from '../controller/generated/v1/api';
import { ResourceType } from '../common/utils';

export class ControllerModel {
	private _endpointsRouter: EndpointsRouterApi;
	private _tokenRouter: TokenRouterApi;
	private _registrationRouter: RegistrationRouterApi;
	private _endpoints: EndpointModel[] = [];
	private _namespace: string = '';
	private _registrations: RegistrationResponse[] = [];
	private _controllerRegistration: RegistrationResponse | undefined = undefined;

	private readonly _onEndpointsUpdated = new vscode.EventEmitter<EndpointModel[]>();
	private readonly _onRegistrationsUpdated = new vscode.EventEmitter<RegistrationResponse[]>();
	public onEndpointsUpdated = this._onEndpointsUpdated.event;
	public onRegistrationsUpdated = this._onRegistrationsUpdated.event;
	public endpointsLastUpdated?: Date;
	public registrationsLastUpdated?: Date;

	constructor(controllerUrl: string, auth: Authentication) {
		this._endpointsRouter = new EndpointsRouterApi(controllerUrl);
		this._endpointsRouter.setDefaultAuthentication(auth);

		this._tokenRouter = new TokenRouterApi(controllerUrl);
		this._tokenRouter.setDefaultAuthentication(auth);

		this._registrationRouter = new RegistrationRouterApi(controllerUrl);
		this._registrationRouter.setDefaultAuthentication(auth);
	}

	public async refresh(): Promise<void> {
		await Promise.all([
			this._endpointsRouter.apiV1BdcEndpointsGet().then(response => {
				this._endpoints = response.body;
				this.endpointsLastUpdated = new Date();
				this._onEndpointsUpdated.fire(this._endpoints);
			}),
			this._tokenRouter.apiV1TokenPost().then(async response => {
				this._namespace = response.body.namespace!;
				this._registrations = (await this._registrationRouter.apiV1RegistrationListResourcesNsGet(this._namespace)).body;
				this._controllerRegistration = this._registrations.find(r => r.instanceType === ResourceType.dataControllers);
				this.registrationsLastUpdated = new Date();
				this._onRegistrationsUpdated.fire(this._registrations);
			})
		]);
	}

	public endpoints(): EndpointModel[] {
		return this._endpoints;
	}

	public endpoint(name: string): EndpointModel | undefined {
		return this._endpoints.find(e => e.name === name);
	}

	public namespace(): string {
		return this._namespace;
	}

	public registrations(): RegistrationResponse[] {
		return this._registrations;
	}

	public get controllerRegistration(): RegistrationResponse | undefined {
		return this._controllerRegistration;
	}

	public getRegistration(type: string, namespace: string, name: string): RegistrationResponse | undefined {
		return this._registrations.find(r => {
			// Resources deployed outside the controller's namespace are named in the format 'namespace_name'
			let instanceName = r.instanceName!;
			const parts: string[] = instanceName.split('_');
			if (parts.length === 2) {
				instanceName = parts[1];
			}
			else if (parts.length > 2) {
				throw new Error(`Cannot parse resource '${instanceName}'. Acceptable formats are 'namespace_name' or 'name'.`);
			}
			return r.instanceType === type && r.instanceNamespace === namespace && instanceName === name;
		});
	}
}
