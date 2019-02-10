/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { ExtensionContext } from 'vscode';

export abstract class WizardBase<T> {

	protected wizard: sqlops.window.modelviewdialog.Wizard;

	constructor(public model: T, public context: ExtensionContext, private title: string) {
	}

	public open() {
		this.wizard = sqlops.window.modelviewdialog.createWizard(this.title);
		this.initialize();
		this.wizard.open();
	}

	protected abstract initialize();
}
