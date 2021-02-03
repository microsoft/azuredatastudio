/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as arc from 'arc';
import * as azdata from 'azdata';
import * as rd from 'resource-deployment';
import { getControllerPassword, getRegisteredDataControllers, reacquireControllerPassword } from '../common/api';
import { throwUnless } from '../common/utils';
import * as loc from '../localizedConstants';
import { AzureArcTreeDataProvider } from '../ui/tree/azureArcTreeDataProvider';

/**
 * Class that provides options sources for an Arc Data Controller
 */
export class ArcControllersOptionsSourceProvider implements rd.IOptionsSourceProvider {
	readonly id = 'arc.controllers';
	constructor(private _treeProvider: AzureArcTreeDataProvider) { }

	public async getOptions(): Promise<string[] | azdata.CategoryValue[]> {
		const controllers = await getRegisteredDataControllers(this._treeProvider);
		throwUnless(controllers !== undefined && controllers.length !== 0, loc.noControllersConnected);
		return controllers.map(ci => {
			return ci.label;
		});
	}

	public async getVariableValue(variableName: string, controllerLabel: string): Promise<string> {
		const controller = (await getRegisteredDataControllers(this._treeProvider)).find(ci => ci.label === controllerLabel);
		throwUnless(controller !== undefined, loc.noControllerInfoFound(controllerLabel));
		switch (variableName) {
			case 'endpoint': return controller.info.url;
			case 'username': return controller.info.username;
			case 'kubeConfig': return controller.info.kubeConfigFilePath;
			case 'clusterContext': return controller.info.kubeClusterContext;
			case 'password': return this.getPassword(controller);
			default: throw new Error(loc.variableValueFetchForUnsupportedVariable(variableName));
		}
	}

	private async getPassword(controller: arc.DataController): Promise<string> {
		let password = await getControllerPassword(this._treeProvider, controller.info);
		if (!password) {
			password = await reacquireControllerPassword(this._treeProvider, controller.info);
		}
		throwUnless(password !== undefined, loc.noPasswordFound(controller.label));
		return password;
	}

	public getIsPassword(variableName: string): boolean {
		switch (variableName) {
			case 'endpoint': return false;
			case 'username': return false;
			case 'kubeConfig': return false;
			case 'clusterContext': return false;
			case 'password': return true;
			default: throw new Error(loc.isPasswordFetchForUnsupportedVariable(variableName));
		}
	}
}
