/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as sqlops from 'sqlops';

import { Action } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import { localize } from 'vs/nls';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';

import { SelectBox, ISelectBoxOptionsWithLabel } from 'sql/base/browser/ui/selectBox/selectBox';
import { INotebookModel } from 'sql/parts/notebook/models/modelInterfaces';
import { CellTypes, CellType } from 'sql/parts/notebook/models/contracts';
import { NotebookComponent } from 'sql/parts/notebook/notebook.component';
import { INotificationService, Severity, INotificationActions } from 'vs/platform/notification/common/notification';
import { NotificationService } from 'vs/workbench/services/notification/common/notificationService';

const msgLoading = localize('loading', 'Loading kernels...');
const kernelLabel: string = localize('Kernel', 'Kernel: ');
const attachToLabel: string = localize('AttachTo', 'Attach to: ');
const msgLocalHost: string = localize('localhost', 'Localhost');

// Action to add a cell to notebook based on cell type(code/markdown).
export class AddCellAction extends Action {
	public cellType: CellType;

	constructor(
		id: string, label: string, cssClass: string
	) {
		super(id, label, cssClass);
	}
	public run(context: NotebookComponent): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				context.addCell(this.cellType);
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class TrustedAction extends Action {
	// Constants
	private static readonly trustLabel = localize('trustLabel', 'Trusted');
	private static readonly notTrustLabel = localize('untrustLabel', 'Not Trusted');
	private static readonly alreadyTrustedMsg = localize('alreadyTrustedMsg', 'Notebook is already trusted.');
	private static readonly trustedCssClass = 'notebook-button icon-trusted';
	private static readonly notTrustedCssClass = 'notebook-button icon-notTrusted';
	// Properties
	private _isTrusted: boolean = false;
	public get trusted(): boolean {
		return this._isTrusted;
	}
	public set trusted(value: boolean) {
		this._isTrusted = value;
		this._setClass(value ? TrustedAction.trustedCssClass : TrustedAction.notTrustedCssClass);
		this._setLabel(value ? TrustedAction.trustLabel : TrustedAction.notTrustLabel);
	}

	constructor(
		id: string,
		@INotificationService private _notificationService: INotificationService
	) {
		super(id, TrustedAction.notTrustLabel, TrustedAction.notTrustedCssClass);
	}

	public run(context: NotebookComponent): TPromise<boolean> {
		let self = this;
		return new TPromise<boolean>((resolve, reject) => {
			try {
				if (self._isTrusted) {
					const actions: INotificationActions = { primary: [] };
					self._notificationService.notify({ severity: Severity.Info, message: TrustedAction.alreadyTrustedMsg, actions });
				}
				else {
					self.trusted = !self._isTrusted;
					context.updateModelTrustDetails(self.trusted);
				}
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class KernelsDropdown extends SelectBox {
	private model: INotebookModel;
	constructor(container: HTMLElement, contextViewProvider: IContextViewProvider, modelRegistered: Promise<INotebookModel>
	) {
		let selectBoxOptionsWithLabel: ISelectBoxOptionsWithLabel = {
			labelText: kernelLabel,
			labelOnTop: false
		};
		super([msgLoading], msgLoading, contextViewProvider, container, selectBoxOptionsWithLabel);
		if (modelRegistered) {
			modelRegistered
				.then((model) => this.updateModel(model))
				.catch((err) => {
					// No-op for now
				});
		}

		this.onDidSelect(e => this.doChangeKernel(e.selected));
	}

	updateModel(model: INotebookModel): void {
		this.model = model;
		model.kernelsChanged((defaultKernel) => {
			this.updateKernel(defaultKernel);
		});
		if (model.clientSession) {
			model.clientSession.kernelChanged((changedArgs: sqlops.nb.IKernelChangedArgs) => {
				if (changedArgs.newValue) {
					this.updateKernel(changedArgs.newValue);
				}
			});
		}
	}

	// Update SelectBox values
	private updateKernel(defaultKernel: sqlops.nb.IKernelSpec) {
		let specs = this.model.specs;
		if (specs && specs.kernels) {
			let index = specs.kernels.findIndex((kernel => kernel.name === defaultKernel.name));
			this.setOptions(specs.kernels.map(kernel => kernel.display_name), index);
		}
	}

	public doChangeKernel(displayName: string): void {
		this.model.changeKernel(displayName);
	}
}

export class AttachToDropdown extends SelectBox {
	constructor(container: HTMLElement, contextViewProvider: IContextViewProvider) {
		let selectBoxOptionsWithLabel: ISelectBoxOptionsWithLabel = {
			labelText: attachToLabel,
			labelOnTop: false
		};
		super([msgLocalHost], msgLocalHost, contextViewProvider, container, selectBoxOptionsWithLabel);
	}
}