/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { OptionsDialog } from 'sql/workbench/browser/modal/optionsDialog';
import { DialogModal } from 'sql/platform/dialog/dialogModal';
import { WizardModal } from 'sql/platform/dialog/wizardModal';
import { Dialog, Wizard, DialogTab } from 'sql/platform/dialog/dialogTypes';
import { IModalOptions } from 'sql/workbench/browser/modal/modal';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

const defaultOptions: IModalOptions = { hasBackButton: false, isWide: false, hasErrors: true };
const defaultWizardOptions: IModalOptions = { hasBackButton: false, isWide: true, hasErrors: true };

export class CustomDialogService {
	private _dialogModals = new Map<Dialog, DialogModal>();
	private _wizardModals = new Map<Wizard, WizardModal>();

	constructor( @IInstantiationService private _instantiationService: IInstantiationService) { }

	public showDialog(dialog: Dialog, dialogName?: string, options?: IModalOptions): void {
		let name = dialogName ? dialogName : 'CustomDialog';
		let dialogModal = this._instantiationService.createInstance(DialogModal, dialog, name, options || defaultOptions);
		this._dialogModals.set(dialog, dialogModal);
		dialogModal.render();
		dialogModal.open();
	}

	public showWizard(wizard: Wizard, options?: IModalOptions): void {
		let wizardModal = this._instantiationService.createInstance(WizardModal, wizard, 'WizardPage', options || defaultWizardOptions);
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
