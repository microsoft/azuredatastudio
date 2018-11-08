/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

 import * as sqlops from 'sqlops';

import { Action } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import { localize } from 'vs/nls';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';

import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { INotebookModel } from 'sql/parts/notebook/models/modelInterfaces';

const msgLoading = localize('loading', 'Loading kernels...');
export class AddCellAction extends Action {
	public static ID = 'jobaction.notebookTest';
	public static LABEL = 'Cell';

	constructor(
	) {
		super(AddCellAction.ID, AddCellAction.LABEL, 'newStepIcon');
	}

	public run(context: any): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class KernelsDropdown extends SelectBox {
	private model: INotebookModel;
	constructor(contextViewProvider: IContextViewProvider, modelRegistered: Promise<INotebookModel>
	) {
		super( [msgLoading], msgLoading, contextViewProvider);
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
			console.log ('toolbar updatekernel');
			let index = specs.kernels.findIndex((kernel => kernel.name === defaultKernel.name));
			this.setOptions(specs.kernels.map(kernel => kernel.display_name), index);
		}
	}
	
	public doChangeKernel(displayName: string): void {
        this.model.changeKernel(displayName);
    }
}

export class AttachToDropdown extends SelectBox {
	constructor(contextViewProvider: IContextViewProvider
	) {
		let options: string[] = ['localhost'];
		super(options, 'localhost', contextViewProvider);
	}
}