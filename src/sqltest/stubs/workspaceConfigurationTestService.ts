/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IWorkspaceConfigurationService  } from 'vs/workbench/services/configuration/common/configuration';
import {
	IConfigurationValue, IConfigurationData, IConfigurationKeys,
	IConfigurationServiceEvent, IConfigurationValues } from 'vs/platform/configuration/common/configuration';
import { TPromise } from 'vs/base/common/winjs.base';
import Event from 'vs/base/common/event';

export class WorkspaceConfigurationTestService implements IWorkspaceConfigurationService {
	_serviceBrand: any;


	getConfigurationData<T>(): IConfigurationData<T> {
		return undefined;
	}

    /**
	 * Returns untrusted configuration keys for the current workspace.
	 */
	getUnsupportedWorkspaceKeys(): string[] {
		return [];
	}

	/**
	 * Returns iff the workspace has configuration or not.
	 */
	hasWorkspaceConfiguration(): boolean {
		return true;
	}

	/**
	 * Returns untrusted configuration keys for the current workspace.
	 */
	getUntrustedConfigurations(): string[] {
		return [];
	}

	/**
	 * Returns if the user explicitly configured to not trust the current workspace.
	 */
	isExplicitlyUntrusted(): boolean {
		return true;
	}

	/**
	 * Override for the IConfigurationService#lookup() method that adds information about workspace settings.
	 */
	lookup<T>(key: string): IConfigurationValue<T> {
		return undefined;
	}

	getConfiguration<T>(section?: string): T {
		return undefined;
	}

	reloadConfiguration<T>(section?: string): TPromise<T> {
		return undefined;
	}

	/**
	 * Override for the IConfigurationService#keys() method that adds information about workspace settings.
	 */
	keys(): IConfigurationKeys {
		return undefined;
	}

	/**
	 * Returns the defined values of configurations in the different scopes.
	 */
	values(): IConfigurationValues {
		return undefined;
	}

	onDidUpdateConfiguration: Event<IConfigurationServiceEvent>;
}