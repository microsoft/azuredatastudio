/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/serverGroupDialog';

import { Colorbox } from 'sql/base/browser/ui/colorbox/colorbox';
import { MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachInputBoxStyler, attachCheckboxStyler } from 'vs/platform/theme/common/styler';
import { Event, Emitter } from 'vs/base/common/event';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { localize } from 'vs/nls';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { ServerGroupViewModel } from 'sql/workbench/services/serverGroup/common/serverGroupViewModel';
import { attachButtonStyler } from 'sql/platform/theme/common/styler';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { ILogService } from 'vs/platform/log/common/log';
import { Color } from 'vs/base/common/color';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { assertIsDefined, isUndefinedOrNull } from 'vs/base/common/types';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';

interface IRenderedServerGroupDialog {
	groupNameInputBox: InputBox;
	groupDescriptionInputBox: InputBox;
	serverGroupContainer: HTMLElement;
	addServerButton: Button;
	closeButton: Button;
}

export class ServerGroupDialog extends Modal {
	private _colorColorBoxesMap: Array<{ color: string, colorbox: Colorbox }> = [];
	private _selectedColorOption?: number;
	private _viewModel?: ServerGroupViewModel;
	private _skipGroupNameValidation: boolean = false;

	private _onAddServerGroup = new Emitter<void>();
	public onAddServerGroup: Event<void> = this._onAddServerGroup.event;

	private _onCancel = new Emitter<void>();
	public onCancel: Event<void> = this._onCancel.event;

	private _onCloseEvent = new Emitter<void>();
	public onCloseEvent: Event<void> = this._onCloseEvent.event;

	// rendered elements
	private isRendered = false;
	private _groupNameInputBox?: InputBox;
	private _groupDescriptionInputBox?: InputBox;
	private _serverGroupContainer?: HTMLElement;
	private _addServerButton?: Button;
	private _closeButton?: Button;

	constructor(
		@ILayoutService layoutService: ILayoutService,
		@IThemeService themeService: IThemeService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(localize('ServerGroupsDialogTitle', "Server Groups"), TelemetryKeys.ServerGroups, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService);
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		const okLabel = localize('serverGroup.ok', "OK");
		const cancelLabel = localize('serverGroup.cancel', "Cancel");
		this._addServerButton = this.addFooterButton(okLabel, () => this.addGroup());
		this._closeButton = this.addFooterButton(cancelLabel, () => this.cancel());
		this.isRendered = true;
		this.registerListeners();
	}

	protected layout(height?: number): void {
		// NO OP
	}

	protected renderBody(container: HTMLElement) {
		const body = DOM.append(container, DOM.$('.server-group-dialog'));

		// Connection Group Name
		const serverGroupNameLabel = localize('connectionGroupName', "Server group name");

		DOM.append(body, DOM.$('.dialog-label')).innerText = serverGroupNameLabel;

		this._groupNameInputBox = new InputBox(DOM.append(body, DOM.$('.input-divider')), this._contextViewService, {
			validationOptions: {
				validation: (value: string) => !value && !this._skipGroupNameValidation ? ({ type: MessageType.ERROR, content: localize('MissingGroupNameError', "Group name is required.") }) : null
			},
			ariaLabel: serverGroupNameLabel
		});

		// Connection Group Description
		const groupDescriptionLabel = localize('groupDescription', "Group description");
		DOM.append(body, DOM.$('.dialog-label')).innerText = groupDescriptionLabel;

		this._groupDescriptionInputBox = new InputBox(DOM.append(body, DOM.$('.input-divider')), this._contextViewService, {
			ariaLabel: groupDescriptionLabel
		});

		// Connection Group Color
		const groupColorLabel = localize('groupColor', "Group color");
		DOM.append(body, DOM.$('.dialog-label')).innerText = groupColorLabel;

		this._serverGroupContainer = DOM.append(body, DOM.$('.group-color-options'));
		this.fillGroupColors(this._serverGroupContainer);

		DOM.addStandardDisposableListener(body, DOM.EventType.KEY_DOWN, (event: StandardKeyboardEvent) => {
			if (event.equals(KeyMod.Shift | KeyCode.Tab)) {
				this.preventDefaultKeyboardEvent(event);
				this.focusPrevious();
			} else if (event.equals(KeyCode.Tab)) {
				this.preventDefaultKeyboardEvent(event);
				this.focusNext();
			} else if (event.equals(KeyCode.RightArrow) || event.equals(KeyCode.LeftArrow)) {
				this.preventDefaultKeyboardEvent(event);
				this.focusNextColor(event.equals(KeyCode.RightArrow));
			}
		});
	}

	private preventDefaultKeyboardEvent(e: StandardKeyboardEvent) {
		e.preventDefault();
		e.stopPropagation();
	}

	private isFocusOnColors(): boolean {
		let result = false;
		this._colorColorBoxesMap.forEach(({ colorbox: colorbox }) => {
			if (document.activeElement === colorbox.domNode) {
				result = true;
			}
		});

		return result;
	}

	private focusNext(): void {
		const renderedDialog = this.withRenderedDialog;
		if (renderedDialog.groupNameInputBox.hasFocus()) {
			renderedDialog.groupDescriptionInputBox.focus();
		} else if (renderedDialog.groupDescriptionInputBox.hasFocus()) {
			this._colorColorBoxesMap[this._selectedColorOption ?? 0].colorbox.focus();
		} else if (this.isFocusOnColors()) {
			renderedDialog.addServerButton.enabled ? renderedDialog.addServerButton.focus() : renderedDialog.closeButton.focus();
		} else if (document.activeElement === renderedDialog.addServerButton.element) {
			renderedDialog.closeButton.focus();
		}
		else if (document.activeElement === renderedDialog.closeButton.element) {
			renderedDialog.groupNameInputBox.focus();
		}
	}

	private focusPrevious(): void {
		const renderedDialog = this.withRenderedDialog;
		if (document.activeElement === renderedDialog.closeButton.element) {
			renderedDialog.addServerButton.enabled ? renderedDialog.addServerButton.focus() : this._colorColorBoxesMap[this._selectedColorOption ?? 0].colorbox.focus();
		} else if (document.activeElement === renderedDialog.addServerButton.element) {
			this._colorColorBoxesMap[this._selectedColorOption ?? 0].colorbox.focus();
		} else if (this.isFocusOnColors()) {
			renderedDialog.groupDescriptionInputBox.focus();
		} else if (renderedDialog.groupDescriptionInputBox.hasFocus()) {
			renderedDialog.groupNameInputBox.focus();
		} else if (renderedDialog.groupNameInputBox.hasFocus()) {
			renderedDialog.closeButton.focus();
		}
	}

	private focusNextColor(moveRight: boolean): void {
		let focusIndex: number = -1;
		for (let i = 0; i < this._colorColorBoxesMap.length; i++) {
			if (document.activeElement === this._colorColorBoxesMap[i].colorbox.domNode) {
				focusIndex = i;
				break;
			}
		}

		if (focusIndex >= 0) {
			if (moveRight) {
				focusIndex++;
			}
			else {
				focusIndex--;
			}

			// check for wraps
			if (focusIndex < 0) {
				focusIndex = this._colorColorBoxesMap.length - 1;
			} else if (focusIndex >= this._colorColorBoxesMap.length) {
				focusIndex = 0;
			}

			this._colorColorBoxesMap[focusIndex].colorbox.focus();
		}
	}

	private onSelectGroupColor(colorToSelect: string): void {
		this.withViewModel.groupColor = colorToSelect;
		this._selectedColorOption = this.withViewModel.colors.indexOf(colorToSelect);
		this.updateView();
	}

	private registerListeners(): void {
		const renderedDialog = this.withRenderedDialog;
		// Theme styler
		this._register(attachInputBoxStyler(renderedDialog.groupNameInputBox, this._themeService));
		this._register(attachInputBoxStyler(renderedDialog.groupDescriptionInputBox, this._themeService));
		this._register(attachButtonStyler(renderedDialog.addServerButton, this._themeService));
		this._register(attachButtonStyler(renderedDialog.closeButton, this._themeService));

		// handler for name change events
		this._register(renderedDialog.groupNameInputBox.onDidChange(groupName => {
			this.groupNameChanged(groupName);
		}));

		// handler for description change events
		this._register(renderedDialog.groupDescriptionInputBox.onDidChange(groupDescription => {
			this.groupDescriptionChanged(groupDescription);
		}));
	}

	private fillGroupColors(container: HTMLElement): void {
		for (let i = 0; i < this.withViewModel.colors.length; i++) {
			const color = this.withViewModel.colors[i];

			const colorColorBox = new Colorbox(container, {
				name: 'server-group-color',
				class: ['server-group-color'],
				label: `Colobox Color: ${color}`,
			});

			this._register(colorColorBox.onSelect((viaKeyboard) => {
				this.onSelectGroupColor(color);
			}));
			colorColorBox.style({
				backgroundColor: Color.fromHex(color)
			});

			// Theme styler
			this._register(attachCheckboxStyler(colorColorBox, this._themeService));

			// add the new colorbox to the color map
			this._colorColorBoxesMap[i] = { color, colorbox: colorColorBox };
		}
	}

	private groupNameChanged(groupName: string) {
		this.withViewModel.groupName = groupName;
		this.updateView();
	}

	private groupDescriptionChanged(groupDescription: string) {
		this.withViewModel.groupDescription = groupDescription;
		this.updateView();
	}

	public get groupName(): string {
		return this.withRenderedDialog.groupNameInputBox.value;
	}

	public get groupDescription(): string {
		return this.withRenderedDialog.groupDescriptionInputBox.value;
	}

	public get selectedColor(): string | undefined {
		return !isUndefinedOrNull(this._selectedColorOption) ? this._colorColorBoxesMap[this._selectedColorOption].color : undefined;
	}

	public get viewModel(): ServerGroupViewModel | undefined {
		return this._viewModel;
	}

	public setViewModel(theViewModel: ServerGroupViewModel) {
		this._viewModel = theViewModel;
		if (this._serverGroupContainer) {
			DOM.clearNode(this._serverGroupContainer);
			this.fillGroupColors(this._serverGroupContainer);
		}
	}

	public addGroup(): void {
		if (this.withRenderedDialog.addServerButton.enabled) {
			if (this.validateInputs()) {
				this._onAddServerGroup.fire();
			}
		}
	}

	public hideError() {
		this.setError('');
	}

	private validateInputs(): boolean {
		const renderedDialog = this.withRenderedDialog;
		let validate = renderedDialog.groupNameInputBox.validate();
		if (!validate) {
			renderedDialog.groupNameInputBox.focus();
		}
		return validate;
	}

	// initialize the view based on the current state of the view model
	private initializeView(): void {
		const renderedDialog = this.withRenderedDialog;
		this.title = this.withViewModel.getDialogTitle();

		this._skipGroupNameValidation = true;
		renderedDialog.groupNameInputBox.value = this.withViewModel.groupName;
		this._skipGroupNameValidation = false;

		renderedDialog.groupDescriptionInputBox.value = this.withViewModel.groupDescription ?? '';

		this.updateView();
	}

	// update UI elements that have derivative behaviors based on other state changes
	private updateView(): void {
		// check the color buttons and if their checked state does not match the view model state then correct it
		for (let i = 0; i < this._colorColorBoxesMap.length; i++) {
			let { colorbox: colorbox, color } = this._colorColorBoxesMap[i];
			if ((this.withViewModel.groupColor === color) && (colorbox.checked === false)) {
				colorbox.checked = true;
				this._selectedColorOption = i;
			} else if ((this.withViewModel.groupColor !== color) && (colorbox.checked === true)) {
				colorbox.checked = false;
			}
		}
		// OK button state - enabled if there are pending changes that can be saved
		this.withRenderedDialog.addServerButton.enabled = this.withViewModel.hasPendingChanges();
	}

	private get withViewModel(): ServerGroupViewModel {
		return assertIsDefined(this._viewModel);
	}

	/* Overwrite escape key behavior */
	protected onClose() {
		this.cancel();
	}

	/* Overwrite enter key behavior */
	protected onAccept() {
		this.addGroup();
	}

	public cancel() {
		this._onCancel.fire();
		this.close();
	}

	public close() {
		this.hide();
		this.withRenderedDialog.groupNameInputBox.hideMessage();
		this._onCloseEvent.fire();
	}

	private get withRenderedDialog(): IRenderedServerGroupDialog {
		if (this.isRendered) {
			// we assume if we are rendered then all our rendered elements are defined
			return {
				groupNameInputBox: this._groupNameInputBox!,
				groupDescriptionInputBox: this._groupDescriptionInputBox!,
				serverGroupContainer: this._serverGroupContainer!,
				addServerButton: this._addServerButton!,
				closeButton: this._closeButton!
			};
		} else {
			throw new Error('Server Group Dialog Not Rendered');
		}
	}

	public open() {
		// reset the dialog
		this.hideError();
		this.initializeView();
		this.show();
		this.withRenderedDialog.groupNameInputBox.focus();
	}
}
