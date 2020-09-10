/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OptionsSource } from '../interfaces';
import { apiService } from '../services/apiService';
import * as arc from 'arc';
import { assert } from '../utils';
import * as loc from '../localizedConstants';

export namespace OptionsSources {
	export class ArcControllersOptionsSource extends OptionsSource {
		private _controllerInfos?: arc.ControllerInfo[];
		private _passwordMap: Map<arc.ControllerInfo, string> = new Map<arc.ControllerInfo, string>();
		private _arcApi?: arc.IExtension | undefined;

		constructor() {
			super();
		}

		async getOptions(): Promise<string[]> {
			if (this._arcApi === undefined) {
				this._arcApi = await apiService.getArcApi();
			}
			if (this._controllerInfos === undefined) {
				this._controllerInfos = await this._arcApi.getRegisteredDataControllers();
				if (this._controllerInfos === undefined || this._controllerInfos.length === 0) {
					throw new Error(loc.noControllersConnected);
				}
			}
			return await Promise.all(this._controllerInfos.map(async ci => {
				this._passwordMap.set(ci, await this._arcApi!.getControllerPassword(ci));
				return ci.name;
			}));
		}

		getVariableValue(variableName: string, input: string): string {
			const controllerInfo = this._controllerInfos!.find(ci => ci.name === input);
			assert(controllerInfo !== undefined, `controllerInfo could not be found unexpectedly for value:${input}`);
			switch (variableName) {
				case 'username':
					return controllerInfo.username;
				case 'password':
					const password = this._passwordMap.get(controllerInfo);
					assert(password !== undefined, `password could not be found unexpectedly for value: ${input}`);
					return password;
				default:
					throw new Error(loc.variableValueFetchForUnsupportedVariable(variableName));
			}
		}

	}
}
