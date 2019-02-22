/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NgModuleRef, enableProdMode, InjectionToken, Type, PlatformRef, Provider } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { IInstantiationService, _util } from 'vs/platform/instantiation/common/instantiation';
import { IEditorInput } from 'vs/workbench/common/editor';
import { Trace } from 'vs/platform/instantiation/common/instantiationService';

const selectorCounter = new Map<string, number>();

export function providerIterator(service: IInstantiationService): Provider[] {
	return Array.from(_util.serviceIds.values()).map(v => {
		return {
			provide: v, useFactory: () => {
				return (<any>service)._getOrCreateServiceInstance(v, Trace.traceCreation(v));
			}
		};
	});
}

export const ISelector = new InjectionToken<string>('selector');

export const IBootstrapParams = new InjectionToken<IBootstrapParams>('bootstrap_params');
export interface IBootstrapParams {
}

export type IModuleFactory<T> = (params: IBootstrapParams, selector: string, service: IInstantiationService) => Type<T>;

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
		platform = platformBrowserDynamic();
	}

	platform.bootstrapModule(moduleType(params, uniqueSelectorString, service)).then(moduleRef => {
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
