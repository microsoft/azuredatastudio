/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NgModuleRef, enableProdMode, InjectionToken, Type, PlatformRef, Provider, Injector } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { IEditorInput } from 'vs/platform/editor/common/editor';
import { IInstantiationService, _util } from 'vs/platform/instantiation/common/instantiation';

const selectorCounter = new Map<string, number>();
const serviceMap = new Map<string, IInstantiationService>();

export const ISelector = new InjectionToken<string>('selector');

export const IBootstrapParams = new InjectionToken<IBootstrapParams>('bootstrap_params');
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

	serviceMap.set(uniqueSelectorString, service);

	if (!platform) {
		// Perform the bootsrap

		const providers: Provider = [];

		_util.serviceIds.forEach(id => {
			providers.push({
				provide: id, useFactory: () => {
					return (<any>serviceMap.get(uniqueSelectorString))._getOrCreateServiceInstance(id);
				}
			});
		});

		platform = platformBrowserDynamic(providers);
	}

	platform.bootstrapModule(moduleType(params, uniqueSelectorString)).then(moduleRef => {
		if (input) {
			input.onDispose(() => {
				serviceMap.delete(uniqueSelectorString);
				moduleRef.destroy();
			});
			moduleRef.onDestroy(() => {
				serviceMap.delete(uniqueSelectorString);
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
