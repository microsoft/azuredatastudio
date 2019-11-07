/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

export enum ApiType {
	FlatFileProvider = 'FlatFileProvider'
}

interface IServiceApi {
	onRegisteredApi<T>(type: ApiType): vscode.Event<T>;
	registerApi<T>(type: ApiType, feature: T): vscode.Disposable;
}

interface IModelViewDefinition {
	id: string;
	modelView: azdata.ModelView;
}

class ServiceApiManager implements IServiceApi {
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
}

export let managerInstance = new ServiceApiManager();
