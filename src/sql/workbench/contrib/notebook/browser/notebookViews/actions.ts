/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';

import { OptionsModal } from 'sql/workbench/contrib/notebook/browser/notebookViews/viewOptionsModal';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { NotebookViewExtension } from 'sql/workbench/services/notebook/browser/models/notebookView';

export class ViewSettings extends Action {
	private static readonly ID = 'viewSettings';
	private static readonly LABEL = undefined;
	private static readonly ICON = 'notebook-button settings masked-icon';

	constructor(
		private _context: NotebookViewExtension,
		@IInstantiationService private _instantiationService: IInstantiationService,
	) {
		super(ViewSettings.ID, ViewSettings.LABEL, ViewSettings.ICON);
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

export class HideCellAction extends Action {
	private static readonly ID = 'hideCell';
	private static readonly LABEL = undefined;//nls.localize('hideCell', "Hide Cell");
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
