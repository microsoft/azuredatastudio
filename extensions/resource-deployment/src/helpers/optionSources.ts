/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { apiService } from '../services/apiService';
import * as arc from 'arc';
import { throwUnless } from '../utils';
import * as loc from '../localizedConstants';
import { IOptionsSource } from '../interfaces';
import { CategoryValue } from 'azdata';


export type OptionsSourceType = 'ArcControllersOptionsSource';

const OptionsSources: Map<OptionsSourceType, new () => OptionsSource> = new Map<OptionsSourceType, new () => OptionsSource>();
export abstract class OptionsSource implements IOptionsSource {

	private _variableNames!: { [index: string]: string; };
	private _type!: OptionsSourceType;

	get type(): OptionsSourceType { return this._type; }
	get variableNames(): { [index: string]: string; } { return this._variableNames; }

	abstract async getOptions(): Promise<string[] | CategoryValue[]>;
	abstract getVariableValue(variableName: string, input: string): Promise<string>;
	abstract getIsPassword(variableName: string): boolean;

	protected constructor() {
	}

	static construct(optionsSourceType: OptionsSourceType, variableNames: { [index: string]: string }): OptionsSource {
		const sourceConstructor = OptionsSources.get(optionsSourceType);
		throwUnless(sourceConstructor !== undefined, loc.noOptionsSourceDefined(optionsSourceType));
		const obj = new sourceConstructor();
		obj._type = optionsSourceType;
		obj._variableNames = variableNames;
		return obj;
	}
}

export class ArcControllersOptionsSource extends OptionsSource {
	private _arcApi?: arc.IExtension | undefined;

	constructor() {
		super();
	}

	private async getArcApi(): Promise<arc.IExtension> {
		if (this._arcApi === undefined) {
			this._arcApi = await apiService.getArcApi();
		}
		return this._arcApi;
	}

	async getOptions(): Promise<string[] | CategoryValue[]> {
		const controllers = await (await this.getArcApi()).getRegisteredDataControllers();
		throwUnless(controllers !== undefined && controllers.length !== 0, loc.noControllersConnected);
		return controllers.map(ci => {
			return ci.label;
		});
	}

	async getVariableValue(variableName: string, controllerLabel: string): Promise<string> {
		const controllers = await (await this.getArcApi()).getRegisteredDataControllers();
		const controller = controllers!.find(ci => ci.label === controllerLabel);
		throwUnless(controller !== undefined, loc.noControllerInfoFound(controllerLabel));
		switch (variableName) {
			case 'username':
				return controller.info.username;
			case 'password':
				let password = await this._arcApi!.getControllerPassword(controller.info);
				if (!password) {
					password = await (await this.getArcApi()).promptForPassword(controller.info, password);
				}
				throwUnless(password !== undefined, loc.noPasswordFound(controllerLabel));
				return password;
			default:
				throw new Error(loc.variableValueFetchForUnsupportedVariable(variableName));
		}
	}

	getIsPassword(variableName: string): boolean {
		switch (variableName) {
			case 'username':
				return false;
			case 'password':
				return true;
			default:
				throw new Error(loc.isPasswordFetchForUnsupportedVariable(variableName));
		}
	}
}
OptionsSources.set(<OptionsSourceType>ArcControllersOptionsSource.name, ArcControllersOptionsSource);

