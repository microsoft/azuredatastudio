/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { Disposable, DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { INotebookKernelService } from 'vs/workbench/contrib/notebook/common/notebookKernelService';
import { INotebookLoggingService } from 'vs/workbench/contrib/notebook/common/notebookLoggingService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';

class NotebookKernelDetection extends Disposable implements IWorkbenchContribution {
	private _detectionMap = new Map<string, IDisposable>();
	private _localDisposableStore = this._register(new DisposableStore());

	constructor(
		@INotebookKernelService private readonly _notebookKernelService: INotebookKernelService,
		@IExtensionService private readonly _extensionService: IExtensionService,
		@INotebookLoggingService private readonly _notebookLoggingService: INotebookLoggingService
	) {
		super();

		this._registerListeners();
	}

	private _registerListeners() {
		this._localDisposableStore.clear();

		this._localDisposableStore.add(this._extensionService.onWillActivateByEvent(e => {
			if (e.event.startsWith('onNotebook:')) {
				if (this._extensionService.activationEventIsDone(e.event)) {
					return;
				}

				// parse the event to get the notebook type
				const notebookType = e.event.substring('onNotebook:'.length);

				if (notebookType === '*') {
					// ignore
					return;
				}

				let shouldStartDetection = false;

				const extensionStatus = this._extensionService.getExtensionsStatus();
				this._extensionService.extensions.forEach(extension => {
					if (extensionStatus[extension.identifier.value].activationTimes) {
						// already activated
						return;
					}
					if (extension.activationEvents?.includes(e.event)) {
						shouldStartDetection = true;
					}
				});

				if (shouldStartDetection && !this._detectionMap.has(notebookType)) {
					this._notebookLoggingService.debug('KernelDetection', `start extension activation for ${notebookType}`);
					const task = this._notebookKernelService.registerNotebookKernelDetectionTask({
						notebookType: notebookType
					});

					this._detectionMap.set(notebookType, task);
				}
			}
		}));

		let timer: any = null;

		this._localDisposableStore.add(this._extensionService.onDidChangeExtensionsStatus(() => {
			if (timer) {
				clearTimeout(timer);
			}

			// activation state might not be updated yet, postpone to next frame
			timer = setTimeout(() => {
				const taskToDelete: string[] = [];
				for (const [notebookType, task] of this._detectionMap) {
					if (this._extensionService.activationEventIsDone(`onNotebook:${notebookType}`)) {
						this._notebookLoggingService.debug('KernelDetection', `finish extension activation for ${notebookType}`);
						taskToDelete.push(notebookType);
						task.dispose();
					}
				}

				taskToDelete.forEach(notebookType => {
					this._detectionMap.delete(notebookType);
				});
			});
		}));

		this._localDisposableStore.add({
			dispose: () => {
				if (timer) {
					clearTimeout(timer);
				}
			}
		});
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(NotebookKernelDetection, LifecyclePhase.Restored);
