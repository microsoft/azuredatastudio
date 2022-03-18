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

	public showDialog(dialog: Dialog, dialogName?: string, options?: IModalOptions): DialogModal {
		let name = dialogName ? dialogName : 'CustomDialog';

		if (options && (options.dialogStyle === 'callout')) {
			options.dialogProperties.xPos = document.activeElement.getBoundingClientRect().left;
			options.dialogProperties.yPos = document.activeElement.getBoundingClientRect().top;
			options.renderFooter = false;
		}
		let dialogModal = this._instantiationService.createInstance(DialogModal, dialog, name, options || DefaultDialogOptions);
		this._dialogModals.set(dialog, dialogModal);
		dialogModal.render();
		dialogModal.open();
		return dialogModal;
	}

	public showWizard(wizard: Wizard, options?: IModalOptions, source?: string): void {
		let wizardModal = this._instantiationService.createInstance(WizardModal, wizard, options || DefaultWizardOptions);
		this._wizardModals.set(wizard, wizardModal);
		wizardModal.render();
		wizardModal.open(source);
	}

	public closeDialog(dialog: Dialog): void {
		this._dialogModals.get(dialog)?.cancel();
	}

	public closeWizard(wizard: Wizard): void {
		this._wizardModals.get(wizard)?.close();
	}

	public getWizardModal(wizard: Wizard): WizardModal | undefined {
		return this._wizardModals.get(wizard);
	}
}
