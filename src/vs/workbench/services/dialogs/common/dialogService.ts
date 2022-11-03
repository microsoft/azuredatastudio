/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Severity from 'vs/base/common/severity';
import { Disposable } from 'vs/base/common/lifecycle';
import { IConfirmation, IConfirmationResult, IDialogOptions, IDialogService, IInput, IInputResult, IShowResult } from 'vs/platform/dialogs/common/dialogs';
import { DialogsModel } from 'vs/workbench/common/dialogs';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { ILogService } from 'vs/platform/log/common/log';

export class DialogService extends Disposable implements IDialogService {

	declare readonly _serviceBrand: undefined;

	readonly model = this._register(new DialogsModel());

	readonly onWillShowDialog = this.model.onWillShowDialog;

	readonly onDidShowDialog = this.model.onDidShowDialog;

	constructor(
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@ILogService private readonly logService: ILogService
	) {
		super();
	}

	private skipDialogs(): boolean {
		if (this.environmentService.isExtensionDevelopment && this.environmentService.extensionTestsLocationURI) {
			return true; // integration tests
		}

		return !!this.environmentService.enableSmokeTestDriver; // smoke tests
	}

	async confirm(confirmation: IConfirmation): Promise<IConfirmationResult> {
		if (this.skipDialogs()) {
			this.logService.trace('DialogService: refused to show confirmation dialog in tests.');

			return { confirmed: true };
		}

		const handle = this.model.show({ confirmArgs: { confirmation } });

		return await handle.result as IConfirmationResult;
	}

	async show(severity: Severity, message: string, buttons?: string[], options?: IDialogOptions): Promise<IShowResult> {
		if (this.skipDialogs()) {
			throw new Error('DialogService: refused to show dialog in tests.');
		}

		const handle = this.model.show({ showArgs: { severity, message, buttons, options } });

		return await handle.result as IShowResult;
	}

	async input(severity: Severity, message: string, buttons: string[], inputs: IInput[], options?: IDialogOptions): Promise<IInputResult> {
		if (this.skipDialogs()) {
			throw new Error('DialogService: refused to show input dialog in tests.');
		}

		const handle = this.model.show({ inputArgs: { severity, message, buttons, inputs, options } });

		return await handle.result as IInputResult;
	}

	async about(): Promise<void> {
		if (this.skipDialogs()) {
			throw new Error('DialogService: refused to show about dialog in tests.');
		}

		const handle = this.model.show({});
		await handle.result;
	}
}

registerSingleton(IDialogService, DialogService, true);
