/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DialogModal } from 'sql/workbench/services/dialog/browser/dialogModal';
import { WizardModal } from 'sql/workbench/services/dialog/browser/wizardModal';
import { Dialog, Wizard } from 'sql/workbench/services/dialog/common/dialogTypes';
import { IModalOptions } from 'sql/workbench/browser/modal/modal';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export const DefaultDialogOptions: IModalOptions = { hasBackButton: false, width: 'narrow', hasErrors: true };
export const DefaultWizardOptions: IModalOptions = { hasBackButton: false, width: 'wide', hasErrors: true };

export class CustomDialogService {
	private _dialogModals = new Map<Dialog, DialogModal>();
	private _wizardModals = new Map<Wizard, WizardModal>();

	constructor(@IInstantiationService private _instantiationService: IInstantiationService) { }

	public showDialog(dialog: Dialog, dialogName?: string, options?: IModalOptions): void {
		let name = dialogName ? dialogName : 'CustomDialog';
		let dialogModal = this._instantiationService.createInstance(DialogModal, dialog, name, options || DefaultDialogOptions);
		this._dialogModals.set(dialog, dialogModal);
		dialogModal.render();
		dialogModal.open();
	}

	public showWizard(wizard: Wizard, options?: IModalOptions): void {
		let wizardModal = this._instantiationService.createInstance(WizardModal, wizard, 'WizardPage', options || DefaultWizardOptions);
		this._wizardModals.set(wizard, wizardModal);
		wizardModal.render();
		wizardModal.open();
	}

	public closeDialog(dialog: Dialog): void {
		let dialogModal = this._dialogModals.get(dialog);
		if (dialogModal) {
			dialogModal.cancel();
		}
	}

	public closeWizard(wizard: Wizard): void {
		let wizardModal = this._wizardModals.get(wizard);
		if (wizardModal) {
			wizardModal.cancel();
		}
	}
}
