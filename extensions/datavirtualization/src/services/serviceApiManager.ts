/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ApiWrapper } from '../apiWrapper';

export enum ApiType {
	ExplorerProvider = 'ExplorerProvider',
	DataSourceWizard = 'DataSourceWizard'
}

export interface IServiceApi {
	onRegisteredApi<T>(type: ApiType): vscode.Event<T>;
	registerApi<T>(type: ApiType, feature: T): vscode.Disposable;
}

export interface IModelViewDefinition {
	id: string;
	modelView: azdata.ModelView;
}

class ServiceApiManager implements IServiceApi {
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

	public registerModelView(id: string, modelView: azdata.ModelView): void {
		this._onRegisteredModelView.fire({
			id: id,
			modelView: modelView
		});
	}

	/**
	 * Performs a one-time registration of a model view provider, where this will be
	 * hooked to an event handler instead of having a predefined method that uses the model view
	 */
	public ensureModelViewRegistered(id: string, apiWrapper: ApiWrapper): any {
		if (!this.modelViewRegistrations[id]) {
			apiWrapper.registerModelViewProvider(id, (modelView) => {
				this.registerModelView(id, modelView);
			});
			this.modelViewRegistrations[id] = true;
		}
	}
}

export let managerInstance = new ServiceApiManager();
