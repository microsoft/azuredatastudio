/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import Severity from 'vs/base/common/severity';
import { IAction, toAction } from 'vs/base/common/actions';
import { MainThreadMessageServiceShape, MainContext, MainThreadMessageOptions } from '../common/extHost.protocol';
import { extHostNamedCustomer, IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { IDialogService, IPromptButton } from 'vs/platform/dialogs/common/dialogs';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { Event } from 'vs/base/common/event';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IExtensionsWorkbenchService } from 'vs/workbench/contrib/extensions/common/extensions'; // {{SQL CARBON EDIT}}}

@extHostNamedCustomer(MainContext.MainThreadMessageService)
export class MainThreadMessageService implements MainThreadMessageServiceShape {

	constructor(
		extHostContext: IExtHostContext,
		@INotificationService private readonly _notificationService: INotificationService,
		@ICommandService private readonly _commandService: ICommandService,
		@IDialogService private readonly _dialogService: IDialogService,
		@IExtensionsWorkbenchService private readonly _extensionService?: IExtensionsWorkbenchService // {{SQL CARBON EDIT}}}
	) {
		//
	}

	dispose(): void {
		//
	}

	$showMessage(severity: Severity, message: string, options: MainThreadMessageOptions, commands: { title: string; isCloseAffordance: boolean; handle: number }[]): Promise<number | undefined> {
		if (options.modal) {
			return this._showModalMessage(severity, message, options.detail, commands, options.useCustom);
		} else {
			return this._showMessage(severity, message, commands, options);
		}
	}

	private _showMessage(severity: Severity, message: string, commands: { title: string; isCloseAffordance: boolean; handle: number }[], options: MainThreadMessageOptions): Promise<number | undefined> {

		return new Promise<number | undefined>(resolve => {

			const primaryActions: IAction[] = commands.map(command => toAction({
				id: `_extension_message_handle_${command.handle}`,
				label: command.title,
				enabled: true,
				run: () => {
					resolve(command.handle);
					return Promise.resolve();
				}
			}));

			let source: string | { label: string; id: string } | undefined;
			if (options.source) {
				source = {
					label: nls.localize('extensionSource', "{0} (Extension)", options.source.label),
					id: options.source.identifier.value
				};
			}

			if (!source) {
				source = nls.localize('defaultSource', "Extension");
			}

			const secondaryActions: IAction[] = [];
			if (options.source) {

				// {{SQL CARBON EDIT}}} - Do not expose 'manage extension' action for built-in extensions to avoid the users from disabling them by mistake.
				const extension = this._extensionService?.local.find(e => e.identifier.id.toUpperCase() === options.source.identifier.value.toUpperCase());
				if (extension && !extension.isBuiltin) {
					secondaryActions.push(toAction({
						id: options.source.identifier.value,
						label: nls.localize('manageExtension', "Manage Extension"),
						run: () => {
							return this._commandService.executeCommand('_extensions.manage', options.source!.identifier.value);
						}
					}));
				}
				// Original code
				// secondaryActions.push(new ManageExtensionAction(options.source.identifier, nls.localize('manageExtension', "Manage Extension"), this._commandService));
				// {{SQL CARBON EDIT}} - End

			}

			const messageHandle = this._notificationService.notify({
				severity,
				message,
				actions: { primary: primaryActions, secondary: secondaryActions },
				source
			});

			// if promise has not been resolved yet, now is the time to ensure a return value
			// otherwise if already resolved it means the user clicked one of the buttons
			Event.once(messageHandle.onDidClose)(() => {
				resolve(undefined);
			});
		});
	}

	private async _showModalMessage(severity: Severity, message: string, detail: string | undefined, commands: { title: string; isCloseAffordance: boolean; handle: number }[], useCustom?: boolean): Promise<number | undefined> {
		const buttons: IPromptButton<number>[] = [];
		let cancelButton: IPromptButton<number | undefined> | undefined = undefined;

		for (const command of commands) {
			const button: IPromptButton<number> = {
				label: command.title,
				run: () => command.handle
			};

			if (command.isCloseAffordance) {
				cancelButton = button;
			} else {
				buttons.push(button);
			}
		}

		if (!cancelButton) {
			if (buttons.length > 0) {
				cancelButton = {
					label: nls.localize('cancel', "Cancel"),
					run: () => undefined
				};
			} else {
				cancelButton = {
					label: nls.localize({ key: 'ok', comment: ['&& denotes a mnemonic'] }, "&&OK"),
					run: () => undefined
				};
			}
		}

		const { result } = await this._dialogService.prompt({
			type: severity,
			message,
			detail,
			buttons,
			cancelButton,
			custom: useCustom
		});

		return result;
	}
}
