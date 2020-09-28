/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Deferred } from '../../common/promise';

export abstract class InitializingComponent {

	private _initialized: boolean = false;

	private onInitializedPromise: Deferred<void> = new Deferred();

	constructor() { }

	protected get initialized(): boolean {
		return this._initialized;
	}

	public get isInitialized(): Promise<void> {
		return this.onInitializedPromise.promise;
	}

	protected set initialized(value: boolean) {
		if (!this._initialized && value) {
			this._initialized = true;
			this.onInitializedPromise.resolve();
		}
	}

	/**
	 * Runs the specified action when the component is initialized. If already initialized just runs
	 * the action immediately.
	 * @param action The action to be ran when the page is initialized
	 */
	protected eventuallyRunOnInitialized(action: () => void): void {
		if (!this._initialized) {
			this.onInitializedPromise.promise.then(() => action()).catch(error => console.error(`Unexpected error running onInitialized action: ${error}`));
		} else {
			action();
		}
	}
}

