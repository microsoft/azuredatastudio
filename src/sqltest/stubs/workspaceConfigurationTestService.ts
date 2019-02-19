/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IWorkspaceConfigurationService } from 'vs/workbench/services/configuration/common/configuration';
import { IConfigurationData, IConfigurationOverrides, ConfigurationTarget, IConfigurationChangeEvent } from 'vs/platform/configuration/common/configuration';

import { Event } from 'vs/base/common/event';
import { IWorkspaceFolder } from 'vs/platform/workspace/common/workspace';

export class WorkspaceConfigurationTestService implements IWorkspaceConfigurationService {
	_serviceBrand: any;

	getValue<T>(): T;
	getValue<T>(section: string): T;
	getValue<T>(overrides: IConfigurationOverrides): T;
	getValue<T>(section: string, overrides: IConfigurationOverrides): T;
	getValue(arg1?: any, arg2?: any): any {
		return Promise.resolve(null);
	}

	onDidChangeConfiguration: Event<IConfigurationChangeEvent>;

	getConfigurationData(): IConfigurationData { return undefined; }

	getConfiguration<T>(): T;
	getConfiguration<T>(section: string): T;
	getConfiguration<T>(overrides: IConfigurationOverrides): T;
	getConfiguration<T>(section: string, overrides: IConfigurationOverrides): T;
	getConfiguration(arg1?: any, arg2?: any): any {
		return Promise.resolve(null);
	}

	updateValue(key: string, value: any): Promise<void>;
	updateValue(key: string, value: any, overrides: IConfigurationOverrides): Promise<void>;
	updateValue(key: string, value: any, target: ConfigurationTarget): Promise<void>;
	updateValue(key: string, value: any, overrides: IConfigurationOverrides, target: ConfigurationTarget): Promise<void>;
	updateValue(key: string, value: any, overrides: IConfigurationOverrides, target: ConfigurationTarget, donotNotifyError: boolean): Promise<void>;
	updateValue(key: string, value: any, arg3?: any, arg4?: any, donotNotifyError?: any): Promise<void> {
		return Promise.resolve(null);
	}

	reloadConfiguration(folder?: IWorkspaceFolder, key?: string): Promise<void> {
		return Promise.resolve(null);
	}

	inspect<T>(key: string): {
		default: T,
		user: T,
		workspace: T,
		workspaceFolder: T,
		memory?: T,
		value: T,
	} { return undefined; }

	keys(): {
		default: string[];
		user: string[];
		workspace: string[];
		workspaceFolder: string[];
		memory?: string[];
	} { return undefined; }

	getUnsupportedWorkspaceKeys(): string[] { return undefined; }
}
