/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Event } from 'vscode';
import * as sqlops from 'sqlops';
import { OptionsDialog } from 'sql/base/browser/ui/modal/optionsDialog';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Emitter } from 'vs/base/common/event';
import { DialogModal } from './dialogModal';
import { WizardModal } from './wizardModal';
import { Dialog, Wizard, OptionsDialogButton } from './dialogTypes';
import { IModalOptions } from '../../base/browser/ui/modal/modal';

const defaultOptions: IModalOptions = { hasBackButton: true, isWide: true };

export class CustomDialogService {
	constructor( @IInstantiationService private _instantiationService: IInstantiationService) { }

	public showDialog(dialog: Dialog, options?: IModalOptions): void {
		let optionsDialog = this._instantiationService.createInstance(DialogModal, dialog, 'CustomDialog', options || defaultOptions);
		optionsDialog.render();
		optionsDialog.open();
	}

	public showWizard(wizard: Wizard, options?: IModalOptions): void {
		let wizardModal = this._instantiationService.createInstance(WizardModal, wizard, 'WizardPage', options || defaultOptions);
		wizardModal.render();
		wizardModal.open();
	}
}