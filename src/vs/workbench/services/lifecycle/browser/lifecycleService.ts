/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ShutdownReason, ILifecycleService } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { ILogService } from 'vs/platform/log/common/log';
import { AbstractLifecycleService } from 'vs/workbench/services/lifecycle/common/lifecycleService';
import { localize } from 'vs/nls';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IDisposable } from 'vs/base/common/lifecycle';
import { addDisposableListener } from 'vs/base/browser/dom';
import { IStorageService } from 'vs/platform/storage/common/storage';

export class BrowserLifecycleService extends AbstractLifecycleService {

	private beforeUnloadDisposable: IDisposable | undefined = undefined;
	private disableUnloadHandling = false;

	constructor(
		@ILogService logService: ILogService,
		@IStorageService storageService: IStorageService
	) {
		super(logService, storageService);

		this.registerListeners();
	}

	private registerListeners(): void {

		// beforeUnload
		this.beforeUnloadDisposable = addDisposableListener(window, 'beforeunload', (e: BeforeUnloadEvent) => this.onBeforeUnload(e));
	}

	private onBeforeUnload(event: BeforeUnloadEvent): void {
		if (this.disableUnloadHandling) {
			this.logService.info('[lifecycle] onBeforeUnload disabled, ignoring once');

			this.disableUnloadHandling = false;

			return; // ignore unload handling only once
		}

		this.logService.info('[lifecycle] onBeforeUnload triggered');

		this.doShutdown(() => {

			// Veto handling
			event.preventDefault();
			event.returnValue = localize('lifecycleVeto', "Changes that you made may not be saved. Please check press 'Cancel' and try again.");
		});
	}

	withExpectedShutdown(reason: ShutdownReason): void;
	withExpectedShutdown(reason: { disableShutdownHandling: true }, callback: Function): void;
	withExpectedShutdown(reason: ShutdownReason | { disableShutdownHandling: true }, callback?: Function): void {

		// Standard shutdown
		if (typeof reason === 'number') {
			this.shutdownReason = reason;
		}

		// Shutdown handling disabled for duration of callback
		else {
			this.disableUnloadHandling = true;
			try {
				callback?.();
			} finally {
				this.disableUnloadHandling = false;
			}
		}
	}

	shutdown(): void {
		this.logService.info('[lifecycle] shutdown triggered');

		// Remove `beforeunload` listener that would prevent shutdown
		this.beforeUnloadDisposable?.dispose();

		// Handle shutdown without veto support
		this.doShutdown();
	}

	private doShutdown(handleVeto?: () => void): void {
		const logService = this.logService;

		let veto = false;

		// Before Shutdown
		this._onBeforeShutdown.fire({
			veto(value, id) {
				if (typeof handleVeto === 'function') {
					if (value instanceof Promise) {
						logService.error(`[lifecycle] Long running operations before shutdown are unsupported in the web (id: ${id})`);

						value = true; // implicitly vetos since we cannot handle promises in web
					}

					if (value === true) {
						logService.info(`[lifecycle]: Unload was prevented (id: ${id})`);

						veto = true;
					}
				}
			},
			reason: ShutdownReason.QUIT
		});

		// Veto: handle if provided
		if (veto && typeof handleVeto === 'function') {
			handleVeto();

			return;
		}

		// No Veto: continue with willShutdown
		this._onWillShutdown.fire({
			join(promise, id) {
				logService.error(`[lifecycle] Long running operations during shutdown are unsupported in the web (id: ${id})`);
			},
			reason: ShutdownReason.QUIT
		});

		// Finally end with didShutdown
		this._onDidShutdown.fire();
	}
}

registerSingleton(ILifecycleService, BrowserLifecycleService);
