/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import { OptionsModal } from 'sql/workbench/contrib/notebook/browser/notebookViews/viewOptionsModal';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotebookView, NotebookViewExtension } from 'sql/workbench/services/notebook/browser/models/notebookView';
import { localize } from 'vs/nls';
import { InsertCellsModal } from 'sql/workbench/contrib/notebook/browser/notebookViews/insertCellsModal';
import { ComponentFactoryResolver, ViewContainerRef } from '@angular/core';
//import { window } from 'vscode';

export class ViewSettingsAction extends Action {
	private static readonly ID = 'viewSettings';
	private static readonly LABEL = undefined;
	private static readonly ICON = 'notebook-button settings masked-icon';

	constructor(
		private _context: NotebookViewExtension,
		@IInstantiationService private _instantiationService: IInstantiationService,
	) {
		super(ViewSettingsAction.ID, ViewSettingsAction.LABEL, ViewSettingsAction.ICON);
	}

	run(): Promise<boolean> {
		try {
			const optionsModal = this._instantiationService.createInstance(OptionsModal);
			optionsModal.open(this._context);
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}
}

export class DeleteViewAction extends Action {
	private static readonly ID = 'viewSettings';
	private static readonly LABEL = undefined;
	private static readonly ICON = 'notebook-button delete masked-icon';

	constructor(
		private _activeView: INotebookView
	) {
		super(DeleteViewAction.ID, DeleteViewAction.LABEL, DeleteViewAction.ICON);
	}

	run(): Promise<boolean> {
		try {
			if (this._activeView) {
				this._activeView.delete();
			} else {
				//window.showErrorMessage(localize('viewsUnableToRemove', "Unable to remove view");)
			}
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}
}

export class InsertCellAction extends Action {
	private static readonly ID = 'viewSettings';
	private static readonly LABEL = localize('insertCells', "Insert Cells");
	private static readonly ICON = 'notebook-button masked-pseudo add-new';

	constructor(
		private _context: NotebookViewExtension,
		private _containerRef: ViewContainerRef,
		private _componentFactoryResolver: ComponentFactoryResolver,
		@IInstantiationService private _instantiationService: IInstantiationService,
	) {
		super(InsertCellAction.ID, InsertCellAction.LABEL, InsertCellAction.ICON);
	}

	run(): Promise<boolean> {
		try {
			const optionsModal = this._instantiationService.createInstance(InsertCellsModal, this._context, this._containerRef, this._componentFactoryResolver);
			optionsModal.render();
			optionsModal.open();
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}
}

export class HideCellAction extends Action {
	private static readonly ID = 'hideCell';
	private static readonly LABEL = undefined;
	private static readonly ICON = 'notebook-button delete masked-icon';

	constructor(
		private hideFn: () => void,
		private context: any
	) {
		super(HideCellAction.ID, HideCellAction.LABEL, HideCellAction.ICON);
	}

	run(): Promise<boolean> {
		try {
			this.hideFn.apply(this.context);
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}
}
