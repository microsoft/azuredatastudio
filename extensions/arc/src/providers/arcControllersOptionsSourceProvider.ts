/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as rd from 'resource-deployment';
import { getRegisteredDataControllers } from '../common/api';
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
			case 'namespace': return controller.info.namespace || '';
			case 'kubeConfig': return controller.info.kubeConfigFilePath;
			case 'clusterContext': return controller.info.kubeClusterContext;
			default: throw new Error(loc.variableValueFetchForUnsupportedVariable(variableName));
		}
	}

	public getIsPassword(variableName: string): boolean {
		switch (variableName) {
			case 'namespace': return false;
			case 'kubeConfig': return false;
			case 'clusterContext': return false;
			default: throw new Error(loc.isPasswordFetchForUnsupportedVariable(variableName));
		}
	}
}
