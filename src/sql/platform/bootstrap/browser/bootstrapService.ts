/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NgModuleRef, PlatformRef, Provider } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { IInstantiationService, _util } from 'vs/platform/instantiation/common/instantiation';
import { IEditorInput } from 'vs/workbench/common/editor';
import { Trace } from 'vs/platform/instantiation/common/instantiationService';
import { values } from 'vs/base/common/map';
import { IModuleFactory, IBootstrapParams } from 'sql/platform/bootstrap/common/bootstrapParams';

const selectorCounter = new Map<string, number>();

export function providerIterator(service: IInstantiationService): Provider[] {
	return Array.from(values(_util.serviceIds)).map(v => {
		let factory = () => {
			return (<any>service)._getOrCreateServiceInstance(v, Trace.traceCreation(v));
		};
		factory.prototype = factory;
		return {
			provide: v, useFactory: factory
		};
	});
}

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
