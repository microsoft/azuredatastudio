/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { apiService } from '../services/apiService';
import * as arc from 'arc';
import { throwUnless } from '../utils';
import * as loc from '../localizedConstants';
import { IOptionsSource } from '../interfaces';


export type OptionsSourceType = 'ArcControllersOptionsSource';

const OptionsSources: Map<OptionsSourceType, new () => OptionsSource> = new Map<OptionsSourceType, new () => OptionsSource>();
export abstract class OptionsSource implements IOptionsSource {

	private _variableNames!: { [index: string]: string; };
	private _type!: OptionsSourceType;

	get type(): OptionsSourceType { return this._type; }
	get variableNames(): { [index: string]: string; } { return this._variableNames; }

	abstract async getOptions(): Promise<string[]>;
	abstract getVariableValue(variableName: string, controllerName: string): string;

	protected constructor() {
	}

	static construct(optionsSourceType: OptionsSourceType, optionsSource: OptionsSource): OptionsSource {
		const sourceConstructor = OptionsSources.get(optionsSourceType);
		throwUnless(sourceConstructor !== undefined, loc.noOptionsSourceDefined(optionsSourceType));
		const obj =  new sourceConstructor();
		obj._variableNames = optionsSource.variableNames;
		return obj;
	}
}

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

	getVariableValue(variableName: string, controllerName: string): string {
		const controllerInfo = this._controllerInfos!.find(ci => ci.name === controllerName);
		throwUnless(controllerInfo !== undefined, loc.noControllerInfoFound(controllerName));
		switch (variableName) {
			case 'username':
				return controllerInfo.username;
			case 'password':
				const password = this._passwordMap.get(controllerInfo);
				throwUnless(password !== undefined, loc.noPasswordFound(controllerName));
				return password;
			default:
				throw new Error(loc.variableValueFetchForUnsupportedVariable(variableName));
		}
	}
}
OptionsSources.set(<OptionsSourceType>ArcControllersOptionsSource.name, ArcControllersOptionsSource);

