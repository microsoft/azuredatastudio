/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IDialogHandler, IDialogResult, IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ILogService } from 'vs/platform/log/common/log';
import { IProductService } from 'vs/platform/product/common/productService';
import { Registry } from 'vs/platform/registry/common/platform';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { IDialogsModel, IDialogViewItem } from 'vs/workbench/common/dialogs';
import { BrowserDialogHandler } from 'vs/workbench/browser/parts/dialogs/dialogHandler';
import { DialogService } from 'vs/workbench/services/dialogs/common/dialogService';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class DialogHandlerContribution extends Disposable implements IWorkbenchContribution {
	private readonly model: IDialogsModel;
	private readonly impl: IDialogHandler;

	private currentDialog: IDialogViewItem | undefined;

	constructor(
		@IDialogService private dialogService: IDialogService,
		@ILogService logService: ILogService,
		@ILayoutService layoutService: ILayoutService,
		@IThemeService themeService: IThemeService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IProductService productService: IProductService,
		@IClipboardService clipboardService: IClipboardService
	) {
		super();

		this.impl = new BrowserDialogHandler(logService, layoutService, themeService, keybindingService, instantiationService, productService, clipboardService);

		this.model = (this.dialogService as DialogService).model;

		this._register(this.model.onWillShowDialog(() => {
			if (!this.currentDialog) {
				this.processDialogs();
			}
		}));

		this.processDialogs();
	}

	private async processDialogs(): Promise<void> {
		while (this.model.dialogs.length) {
			this.currentDialog = this.model.dialogs[0];

			let result: IDialogResult | undefined = undefined;
			if (this.currentDialog.args.confirmArgs) {
				const args = this.currentDialog.args.confirmArgs;
				result = await this.impl.confirm(args.confirmation);
			} else if (this.currentDialog.args.inputArgs) {
				const args = this.currentDialog.args.inputArgs;
				result = await this.impl.input(args.severity, args.message, args.buttons, args.inputs, args.options);
			} else if (this.currentDialog.args.showArgs) {
				const args = this.currentDialog.args.showArgs;
				result = await this.impl.show(args.severity, args.message, args.buttons, args.options);
			} else {
				await this.impl.about();
			}

			this.currentDialog.close(result);
			this.currentDialog = undefined;
		}
	}
}

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(DialogHandlerContribution, LifecyclePhase.Starting);
