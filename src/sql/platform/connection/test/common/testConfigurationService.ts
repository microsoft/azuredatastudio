/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getConfigurationKeys, IConfigurationOverrides, IConfigurationService, getConfigurationValue, ConfigurationTarget, IConfigurationChangeEvent } from 'vs/platform/configuration/common/configuration';
import { Emitter, Event } from 'vs/base/common/event';
import { ConfigurationChangeEvent } from 'vs/platform/configuration/common/configurationModels';

export class TestConfigurationService implements IConfigurationService {
	public _serviceBrand: undefined;

	private configuration = {
		user: {},
		workspace: {}
	};

	public reloadConfiguration<T>(): Promise<T> {
		return Promise.resolve(this.getValue());
	}

	public getValue(arg1?: any): any {
		return getConfigurationValue(this.configuration.user, arg1);
	}

	public updateValue(key: string, value: any, target?: any): Promise<void> {
		let _target = (target as ConfigurationTarget) === ConfigurationTarget.USER ? 'user' : 'workspace';
		let keyArray = key.split('.');
		let targetObject = this.configuration[_target];
		for (let i = 0; i < keyArray.length; i++) {
			if (i === keyArray.length - 1) {
				targetObject[keyArray[i]] = value;
			} else {
				if (!targetObject[keyArray[i]]) {
					targetObject[keyArray[i]] = {};
				}
				targetObject = targetObject[keyArray[i]];
			}
		}
		this._onDidChangeConfiguration.fire(new ConfigurationChangeEvent().change([key]).telemetryData(target, this.getTargetConfiguration(target)));
		return Promise.resolve(void 0);
	}

	private getTargetConfiguration(target: ConfigurationTarget): any {
		switch (target) {
			case ConfigurationTarget.DEFAULT:
				return this.configuration.workspace;
			case ConfigurationTarget.USER:
				return this.configuration.user;
		}
		return {};
	}

	private readonly _onDidChangeConfiguration: Emitter<IConfigurationChangeEvent> = new Emitter<IConfigurationChangeEvent>();
	readonly onDidChangeConfiguration: Event<IConfigurationChangeEvent> = this._onDidChangeConfiguration.event;

	public inspect<T>(key: string, overrides?: IConfigurationOverrides): {
		default: T,
		user: T,
		workspace?: T,
		workspaceFolder?: T
		value: T,
	} {

		return {
			value: getConfigurationValue<T>(this.configuration.user, key),
			default: undefined,
			user: getConfigurationValue<T>(this.configuration.user, key),
			workspace: getConfigurationValue<T>(this.configuration.workspace, key),
			workspaceFolder: undefined
		};
	}

	public keys() {
		return {
			default: getConfigurationKeys(),
			user: Object.keys(this.configuration),
			workspace: [],
			workspaceFolder: []
		};
	}

	public getConfigurationData() {
		return null;
	}
}
