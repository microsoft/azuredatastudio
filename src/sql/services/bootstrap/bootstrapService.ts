/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NgModuleRef, enableProdMode, InjectionToken, ReflectiveInjector, Type, PlatformRef, Provider } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { IEditorInput } from 'vs/platform/editor/common/editor';
<<<<<<< HEAD
import { IInstantiationService, _util } from 'vs/platform/instantiation/common/instantiation';
=======
import { IInstantiationService, ServicesAccessor, ServiceIdentifier } from 'vs/platform/instantiation/common/instantiation';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IAccountManagementService } from 'sql/services/accountManagement/interfaces';
import { IWindowsService, IWindowService } from 'vs/platform/windows/common/windows';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IClipboardService as vsIClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IProgressService } from 'vs/platform/progress/common/progress';
>>>>>>> master

const selectorCounter = new Map<string, number>();

export const IBootstrapParams = new InjectionToken('bootstrap_params');
export interface IBootstrapParams {
}

export type IModuleFactory<T> = (params: IBootstrapParams, selector: string) => Type<T>;

function createUniqueSelector(selector: string): string {
	let num: number;
	if (selectorCounter.has(selector)) {
		num = selectorCounter.get(selector);
	} else {
		num = 0;
	}
	selectorCounter.set(selector, num + 1);
	return `${selector}_${num}`;
}

let platform: PlatformRef;

export function bootstrapAngular<T>(service: IInstantiationService, moduleType: IModuleFactory<T>, container: HTMLElement, selectorString: string, params: IBootstrapParams, input?: IEditorInput, callbackSetModule?: (value: NgModuleRef<T>) => void): string {
	// Create the uniqueSelectorString
	let uniqueSelectorString = createUniqueSelector(selectorString);
	let selector = document.createElement(uniqueSelectorString);
	container.appendChild(selector);

	if (!platform) {
		// Perform the bootsrap

		const providers: Provider = [];

		_util.serviceIds.forEach(id => {
			providers.push({ provide: id, useFactory: () => (<any>service)._getOrCreateServiceInstance(id) });
		});

		platform = platformBrowserDynamic(providers);
	}

	platform.bootstrapModule(moduleType(params, uniqueSelectorString)).then(moduleRef => {
		if (input) {
			input.onDispose(() => {
				moduleRef.destroy();
			});
		}
		if (callbackSetModule) {
			callbackSetModule(moduleRef);
		}
	});

	return uniqueSelectorString;
}

if (!process.env['VSCODE_DEV']) {
	enableProdMode();
}
