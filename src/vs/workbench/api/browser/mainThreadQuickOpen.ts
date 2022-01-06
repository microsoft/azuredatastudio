/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPickOptions, IInputOptions, IQuickInputService, IQuickInput, IQuickPick, IQuickPickItem } from 'vs/platform/quickinput/common/quickInput';
import { ExtHostContext, MainThreadQuickOpenShape, ExtHostQuickOpenShape, TransferQuickPickItems, MainContext, IExtHostContext, TransferQuickInput, TransferQuickInputButton, IInputBoxOptions } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { URI } from 'vs/base/common/uri';
import { CancellationToken } from 'vs/base/common/cancellation';

interface QuickInputSession {
	input: IQuickInput;
	handlesToItems: Map<number, TransferQuickPickItems>;
}

function reviveIconPathUris(iconPath: { dark: URI; light?: URI | undefined; }) {
	iconPath.dark = URI.revive(iconPath.dark);
	if (iconPath.light) {
		iconPath.light = URI.revive(iconPath.light);
	}
}

@extHostNamedCustomer(MainContext.MainThreadQuickOpen)
export class MainThreadQuickOpen implements MainThreadQuickOpenShape {

	private readonly _proxy: ExtHostQuickOpenShape;
	private readonly _quickInputService: IQuickInputService;
	private readonly _items: Record<number, {
		resolve(items: TransferQuickPickItems[]): void;
		reject(error: Error): void;
	}> = {};

	constructor(
		extHostContext: IExtHostContext,
		@IQuickInputService quickInputService: IQuickInputService
	) {
		this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostQuickOpen);
		this._quickInputService = quickInputService;
	}

	public dispose(): void {
	}

	$show(instance: number, options: IPickOptions<TransferQuickPickItems>, token: CancellationToken): Promise<number | number[] | undefined> {
		// {{SQL CARBON EDIT}} Fix a11y issue https://github.com/microsoft/azuredatastudio/issues/9232
		const activeElement = document.activeElement as HTMLElement;
		const focusBackToStartingPosition = () => {
			try {
				activeElement?.focus();
			} catch { }
		};
		// {{SQL CARBON EDIT}} Fix a11y issue https://github.com/microsoft/azuredatastudio/issues/9232

		const contents = new Promise<TransferQuickPickItems[]>((resolve, reject) => {
			this._items[instance] = { resolve, reject };
		});

		options = {
			...options,
			onDidFocus: el => {
				if (el) {
					this._proxy.$onItemSelected((<TransferQuickPickItems>el).handle);
				}
			}
		};

		if (options.canPickMany) {
			return this._quickInputService.pick(contents, options as { canPickMany: true }, token).then(items => {
				focusBackToStartingPosition(); // {{SQL CARBON EDIT}} Fix a11y issue https://github.com/microsoft/azuredatastudio/issues/9232
				if (items) {
					return items.map(item => item.handle);
				}
				return undefined;
			});
		} else {
			return this._quickInputService.pick(contents, options, token).then(item => {
				focusBackToStartingPosition(); // {{SQL CARBON EDIT}} Fix a11y issue https://github.com/microsoft/azuredatastudio/issues/9232
				if (item) {
					return item.handle;
				}
				return undefined;
			});
		}
	}

	$setItems(instance: number, items: TransferQuickPickItems[]): Promise<void> {
		if (this._items[instance]) {
			this._items[instance].resolve(items);
			delete this._items[instance];
		}
		return Promise.resolve();
	}

	$setError(instance: number, error: Error): Promise<void> {
		if (this._items[instance]) {
			this._items[instance].reject(error);
			delete this._items[instance];
		}
		return Promise.resolve();
	}

	// ---- input

	$input(options: IInputBoxOptions | undefined, validateInput: boolean, token: CancellationToken): Promise<string | undefined> {
		const inputOptions: IInputOptions = Object.create(null);

		if (options) {
			inputOptions.title = options.title;
			inputOptions.password = options.password;
			inputOptions.placeHolder = options.placeHolder;
			inputOptions.valueSelection = options.valueSelection;
			inputOptions.prompt = options.prompt;
			inputOptions.value = options.value;
			inputOptions.ignoreFocusLost = options.ignoreFocusOut;
		}

		if (validateInput) {
			inputOptions.validateInput = (value) => {
				return this._proxy.$validateInput(value);
			};
		}

		return this._quickInputService.input(inputOptions, token);
	}

	// ---- QuickInput

	private sessions = new Map<number, QuickInputSession>();

	$createOrUpdate(params: TransferQuickInput): Promise<void> {
		const sessionId = params.id;
		let session = this.sessions.get(sessionId);
		if (!session) {

			const input = params.type === 'quickPick' ? this._quickInputService.createQuickPick() : this._quickInputService.createInputBox();
			input.onDidAccept(() => {
				this._proxy.$onDidAccept(sessionId);
			});
			input.onDidTriggerButton(button => {
				this._proxy.$onDidTriggerButton(sessionId, (button as TransferQuickInputButton).handle);
			});
			input.onDidChangeValue(value => {
				this._proxy.$onDidChangeValue(sessionId, value);
			});
			input.onDidHide(() => {
				this._proxy.$onDidHide(sessionId);
			});

			if (params.type === 'quickPick') {
				// Add extra events specific for quickpick
				const quickpick = input as IQuickPick<IQuickPickItem>;
				quickpick.onDidChangeActive(items => {
					this._proxy.$onDidChangeActive(sessionId, items.map(item => (item as TransferQuickPickItems).handle));
				});
				quickpick.onDidChangeSelection(items => {
					this._proxy.$onDidChangeSelection(sessionId, items.map(item => (item as TransferQuickPickItems).handle));
				});
				quickpick.onDidTriggerItemButton((e) => {
					this._proxy.$onDidTriggerItemButton(sessionId, (e.item as TransferQuickPickItems).handle, (e.button as TransferQuickInputButton).handle);
				});
			}

			session = {
				input,
				handlesToItems: new Map()
			};
			this.sessions.set(sessionId, session);
		}
		const { input, handlesToItems } = session;
		for (const param in params) {
			if (param === 'id' || param === 'type') {
				continue;
			}
			if (param === 'visible') {
				if (params.visible) {
					input.show();
				} else {
					input.hide();
				}
			} else if (param === 'items') {
				handlesToItems.clear();
				params[param].forEach((item: TransferQuickPickItems) => {
					if (item.buttons) {
						item.buttons = item.buttons.map((button: TransferQuickInputButton) => {
							if (button.iconPath) {
								reviveIconPathUris(button.iconPath);
							}

							return button;
						});
					}
					handlesToItems.set(item.handle, item);
				});
				(input as any)[param] = params[param];
			} else if (param === 'activeItems' || param === 'selectedItems') {
				(input as any)[param] = params[param]
					.filter((handle: number) => handlesToItems.has(handle))
					.map((handle: number) => handlesToItems.get(handle));
			} else if (param === 'buttons') {
				(input as any)[param] = params.buttons!.map(button => {
					if (button.handle === -1) {
						return this._quickInputService.backButton;
					}

					if (button.iconPath) {
						reviveIconPathUris(button.iconPath);
					}

					return button;
				});
			} else {
				(input as any)[param] = params[param];
			}
		}
		return Promise.resolve(undefined);
	}

	$dispose(sessionId: number): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.input.dispose();
			this.sessions.delete(sessionId);
		}
		return Promise.resolve(undefined);
	}
}
