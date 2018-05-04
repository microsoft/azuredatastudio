/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { OptionsDialog } from 'sql/base/browser/ui/modal/optionsDialog';
import { DialogModal } from 'sql/platform/dialog/dialogModal';
import { Dialog } from 'sql/platform/dialog/dialogTypes';
import { IModalOptions } from 'sql/base/browser/ui/modal/modal';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

const defaultOptions: IModalOptions = { hasBackButton: true, isWide: false };

export class CustomDialogService {
	private _dialogModals = new Map<Dialog, DialogModal>();

	constructor( @IInstantiationService private _instantiationService: IInstantiationService) { }

	public showDialog(dialog: Dialog, options?: IModalOptions): void {
		let dialogModal = this._instantiationService.createInstance(DialogModal, dialog, 'CustomDialog', options || defaultOptions);
		this._dialogModals.set(dialog, dialogModal);
		dialogModal.render();
		dialogModal.open();
	}

	public closeDialog(dialog: Dialog): void {
		let dialogModal = this._dialogModals.get(dialog);
		if (dialogModal) {
			dialogModal.cancel();
		}
	}
}
