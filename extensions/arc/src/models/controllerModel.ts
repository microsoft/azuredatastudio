/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Authentication } from '../controller/auth';
import { EndpointsRouterApi, EndpointModel, RegistrationRouterApi, RegistrationResponse, TokenRouterApi, SqlInstanceRouterApi } from '../controller/generated/v1/api';
import { parseEndpoint, parseInstanceName } from '../common/utils';
import { ResourceType } from '../constants';

export interface Registration extends RegistrationResponse {
	externalIp?: string;
	externalPort?: string;
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

	private readonly _onEndpointsUpdated = new vscode.EventEmitter<EndpointModel[]>();
	private readonly _onRegistrationsUpdated = new vscode.EventEmitter<Registration[]>();
	public onEndpointsUpdated = this._onEndpointsUpdated.event;
	public onRegistrationsUpdated = this._onRegistrationsUpdated.event;
	public endpointsLastUpdated?: Date;
	public registrationsLastUpdated?: Date;

	constructor(public readonly controllerUrl: string, public readonly auth: Authentication) {
		this._endpointsRouter = new EndpointsRouterApi(controllerUrl);
		this._endpointsRouter.setDefaultAuthentication(auth);

		this._tokenRouter = new TokenRouterApi(controllerUrl);
		this._tokenRouter.setDefaultAuthentication(auth);

		this._registrationRouter = new RegistrationRouterApi(controllerUrl);
		this._registrationRouter.setDefaultAuthentication(auth);

		this._sqlInstanceRouter = new SqlInstanceRouterApi(controllerUrl);
		this._sqlInstanceRouter.setDefaultAuthentication(auth);
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
				this._registrations = (await this._registrationRouter.apiV1RegistrationListResourcesNsGet(this._namespace)).body.map(mapRegistrationResponse);
				this._controllerRegistration = this._registrations.find(r => r.instanceType === ResourceType.dataControllers);
				this.registrationsLastUpdated = new Date();
				this._onRegistrationsUpdated.fire(this._registrations);
			})
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

	public getRegistration(type: string, namespace: string, name: string): Registration | undefined {
		return this._registrations.find(r => {
			return r.instanceType === type && r.instanceNamespace === namespace && parseInstanceName(r.instanceName) === name;
		});
	}

	public async miaaDelete(namespace: string, name: string): Promise<void> {
		await this._sqlInstanceRouter.apiV1HybridSqlNsNameDelete(namespace, name);
	}
}

/**
 * Maps a RegistrationResponse to a Registration,
 * @param response The RegistrationResponse to map
 */
function mapRegistrationResponse(response: RegistrationResponse): Registration {
	const parsedEndpoint = parseEndpoint(response.externalEndpoint);
	return { ...response, externalIp: parsedEndpoint.ip, externalPort: parsedEndpoint.port };
}
