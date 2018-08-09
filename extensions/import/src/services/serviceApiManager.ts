/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as contracts from './contracts';
import { SqlOpsDataClient } from 'dataprotocol-client/lib/main';

export enum ApiType {
	FlatFileProvider = 'FlatFileProvider'
}

export interface IServiceApi {
	onRegisteredApi<T>(type: ApiType): vscode.Event<T>;
	registerApi<T>(type: ApiType, feature: T): vscode.Disposable;
}

export interface IModelViewDefinition {
	id: string;
	modelView: sqlops.ModelView;
}

export class ServiceApiManager implements IServiceApi {
	private modelViewRegistrations: { [id: string]: boolean } = {};
	private featureEventChannels: { [type: string]: vscode.EventEmitter<any> } = {};
	private _onRegisteredModelView = new vscode.EventEmitter<IModelViewDefinition>();

	public onRegisteredApi<T>(type: ApiType): vscode.Event<T> {
		let featureEmitter = this.featureEventChannels[type];
		if (!featureEmitter) {
			featureEmitter = new vscode.EventEmitter<T>();
			this.featureEventChannels[type] = featureEmitter;
		}
		return featureEmitter.event;
	}

	public registerApi<T>(type: ApiType, feature: T): vscode.Disposable {
		let featureEmitter = this.featureEventChannels[type];
		if (featureEmitter) {
			featureEmitter.fire(feature);
		}
		// TODO handle unregistering API on close
		return {
			dispose: () => undefined
		};
	}

	public get onRegisteredModelView(): vscode.Event<IModelViewDefinition> {
		return this._onRegisteredModelView.event;
	}

	public registerModelView(id: string, modelView: sqlops.ModelView): void {
		this._onRegisteredModelView.fire({
			id: id,
			modelView: modelView
		});
	}
}

export let managerInstance = new ServiceApiManager();
