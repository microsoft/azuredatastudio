/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { ITextModel } from 'vs/editor/common/model';
import { IModelService } from 'vs/editor/common/services/model';
import { localize } from 'vs/nls';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITerminalInstance, ITerminalService, IXtermTerminal } from 'vs/workbench/contrib/terminal/browser/terminal';
import type { Terminal } from 'xterm';
import { ITerminalCommand, TerminalCapability } from 'vs/platform/terminal/common/capabilities/capabilities';
import { IQuickInputService, IQuickPick, IQuickPickItem } from 'vs/platform/quickinput/common/quickInput';
import { AudioCue, IAudioCueService } from 'vs/platform/audioCues/browser/audioCueService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { withNullAsUndefined } from 'vs/base/common/types';
import { BufferContentTracker } from 'vs/workbench/contrib/terminalContrib/accessibility/browser/bufferContentTracker';
import { ILogService } from 'vs/platform/log/common/log';
import { IEditorViewState } from 'vs/editor/common/editorCommon';
import { TerminalAccessibleWidget } from 'vs/workbench/contrib/terminalContrib/accessibility/browser/terminalAccessibleWidget';
import { TerminalContextKeys } from 'vs/workbench/contrib/terminal/common/terminalContextKey';

export const enum NavigationType {
	Next = 'next',
	Previous = 'previous'
}

interface IAccessibleBufferQuickPickItem extends IQuickPickItem {
	lineNumber: number;
	exitCode?: number;
}

export const enum ClassName {
	AccessibleBuffer = 'accessible-buffer',
	Active = 'active'
}

export class AccessibleBufferWidget extends TerminalAccessibleWidget {
	private _isUpdating: boolean = false;
	private _pendingUpdates = 0;

	private _bufferTracker: BufferContentTracker;

	private _cursorPosition: { lineNumber: number; column: number } | undefined;

	constructor(
		_instance: Pick<ITerminalInstance, 'shellType' | 'capabilities' | 'onDidRequestFocus' | 'resource'>,
		_xterm: Pick<IXtermTerminal, 'shellIntegration' | 'getFont'> & { raw: Terminal },
		@IInstantiationService _instantiationService: IInstantiationService,
		@IModelService _modelService: IModelService,
		@IConfigurationService _configurationService: IConfigurationService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@IAudioCueService private readonly _audioCueService: IAudioCueService,
		@IContextKeyService _contextKeyService: IContextKeyService,
		@ILogService private readonly _logService: ILogService,
		@ITerminalService _terminalService: ITerminalService
	) {
		super(ClassName.AccessibleBuffer, _instance, _xterm, TerminalContextKeys.accessibleBufferFocus, _instantiationService, _modelService, _configurationService, _contextKeyService, _terminalService);
		this._bufferTracker = _instantiationService.createInstance(BufferContentTracker, _xterm);
		this.element.ariaRoleDescription = localize('terminal.integrated.accessibleBuffer', 'Terminal buffer');
		this.updateEditor();
		this.add(this.editorWidget.onDidFocusEditorText(async () => {
			if (this.element.classList.contains(ClassName.Active)) {
				// the user has focused the editor via mouse or
				// Go to Command was run so we've already updated the editor
				return;
			}
			// if the editor is focused via tab, we need to update the model
			// and show it
			this.registerListeners();
			await this.updateEditor();
			this.element.classList.add(ClassName.Active);
		}));
	}

	navigateToCommand(type: NavigationType): void {
		const currentLine = this.editorWidget.getPosition()?.lineNumber || this._getDefaultCursorPosition()?.lineNumber;
		const commands = this._getCommandsWithEditorLine();
		if (!commands?.length || !currentLine) {
			return;
		}

		const filteredCommands = type === NavigationType.Previous ? commands.filter(c => c.lineNumber < currentLine).sort((a, b) => b.lineNumber - a.lineNumber) : commands.filter(c => c.lineNumber > currentLine).sort((a, b) => a.lineNumber - b.lineNumber);
		if (!filteredCommands.length) {
			return;
		}
		this._cursorPosition = { lineNumber: filteredCommands[0].lineNumber, column: 1 };
		this._resetPosition();
	}

	private _getEditorLineForCommand(command: ITerminalCommand): number | undefined {
		let line = command.marker?.line;
		if (line === undefined || !command.command.length || line < 0) {
			return undefined;
		}
		line = this._bufferTracker.bufferToEditorLineMapping.get(line);
		if (line === undefined) {
			return undefined;
		}
		return line + 1;
	}

	private _getCommandsWithEditorLine(): ICommandWithEditorLine[] | undefined {
		const commands = this._instance.capabilities.get(TerminalCapability.CommandDetection)?.commands;
		if (!commands?.length) {
			return undefined;
		}
		const result: ICommandWithEditorLine[] = [];
		for (const command of commands) {
			const lineNumber = this._getEditorLineForCommand(command);
			if (!lineNumber) {
				continue;
			}
			result.push({ command, lineNumber });
		}
		return result;
	}

	async createQuickPick(): Promise<IQuickPick<IAccessibleBufferQuickPickItem> | undefined> {
		this._cursorPosition = withNullAsUndefined(this.editorWidget.getPosition());
		const commands = this._getCommandsWithEditorLine();
		if (!commands) {
			return undefined;
		}
		const quickPickItems: IAccessibleBufferQuickPickItem[] = [];
		for (const { command, lineNumber } of commands) {
			const line = this._getEditorLineForCommand(command);
			if (!line) {
				continue;
			}
			quickPickItems.push(
				{
					label: localize('terminal.integrated.symbolQuickPick.labelNoExitCode', '{0}', command.command),
					lineNumber,
					exitCode: command.exitCode
				});
		}
		const quickPick = this._quickInputService.createQuickPick<IAccessibleBufferQuickPickItem>();
		quickPick.canSelectMany = false;
		quickPick.onDidChangeActive(() => {
			const activeItem = quickPick.activeItems[0];
			if (!activeItem) {
				return;
			}
			if (activeItem.exitCode) {
				this._audioCueService.playAudioCue(AudioCue.error, true);
			}
			this.editorWidget.revealLine(activeItem.lineNumber, 0);
		});
		quickPick.onDidHide(() => {
			this._resetPosition();
			quickPick.dispose();
		});
		quickPick.onDidAccept(() => {
			const item = quickPick.activeItems[0];
			const model = this.editorWidget.getModel();
			if (!model) {
				return;
			}
			if (!item && this._cursorPosition) {
				this._resetPosition();
			} else {
				this._cursorPosition = { lineNumber: item.lineNumber, column: 1 };
			}
			quickPick.dispose();
			this.editorWidget.focus();
			return;
		});
		quickPick.items = quickPickItems.reverse();
		return quickPick;
	}

	private _resetPosition(): void {
		this._cursorPosition = this._cursorPosition ?? this._getDefaultCursorPosition();
		if (!this._cursorPosition) {
			return;
		}
		this.editorWidget.setPosition(this._cursorPosition);
		this.editorWidget.setScrollPosition({ scrollTop: this.editorWidget.getTopForLineNumber(this._cursorPosition.lineNumber) });
	}

	override layout(): void {
		if (this._bufferTracker) {
			this._bufferTracker.reset();
		}
		super.layout();
	}

	async updateEditor(dataChanged?: boolean): Promise<void> {
		if (this._isUpdating) {
			this._pendingUpdates++;
			return;
		}
		this._isUpdating = true;
		const model = await this._updateModel(dataChanged);
		if (!model) {
			return;
		}
		this._isUpdating = false;
		if (this._pendingUpdates) {
			this._logService.debug('TerminalAccessibleBuffer._updateEditor: pending updates', this._pendingUpdates);
			this._pendingUpdates--;
			await this.updateEditor(dataChanged);
		}
	}

	override registerListeners(): void {
		super.registerListeners();
		this._xterm.raw.onWriteParsed(async () => {
			if (this._xterm.raw.buffer.active.baseY === 0) {
				await this.updateEditor(true);
			}
		});
		const onRequestUpdateEditor = Event.latch(this._xterm.raw.onScroll);
		this._listeners.push(onRequestUpdateEditor(async () => await this.updateEditor(true)));
	}

	private _getDefaultCursorPosition(): { lineNumber: number; column: number } | undefined {
		const modelLineCount = this.editorWidget.getModel()?.getLineCount();
		return modelLineCount ? { lineNumber: modelLineCount, column: 1 } : undefined;
	}

	private async _updateModel(dataChanged?: boolean): Promise<ITextModel> {
		const linesBefore = this._bufferTracker.lines.length;
		this._bufferTracker.update();
		const linesAfter = this._bufferTracker.lines.length;
		const modelChanged = linesBefore !== linesAfter;

		// Save the view state before the update if it was set by the user
		let savedViewState: IEditorViewState | undefined;
		if (dataChanged) {
			savedViewState = withNullAsUndefined(this.editorWidget.saveViewState());
		}

		let model = this.editorWidget.getModel();
		const text = this._bufferTracker.lines.join('\n');
		if (model) {
			model.setValue(text);
		} else {
			model = await this.getTextModel(this._instance.resource.with({ fragment: `${ClassName.AccessibleBuffer}-${text}` }));
		}
		this.editorWidget.setModel(model);

		// If the model changed due to new data, restore the view state
		// If the model changed due to a refresh or the cursor is a the top, set to the bottom of the buffer
		// Otherwise, don't change the position
		const positionTopOfBuffer = this.editorWidget.getPosition()?.lineNumber === 1 && this.editorWidget.getPosition()?.column === 1;
		if (savedViewState) {
			this.editorWidget.restoreViewState(savedViewState);
		} else if (modelChanged || positionTopOfBuffer) {
			const defaultPosition = this._getDefaultCursorPosition();
			if (defaultPosition) {
				this.editorWidget.setPosition(defaultPosition);
				this.editorWidget.setScrollPosition({ scrollTop: this.editorWidget.getTopForLineNumber(defaultPosition.lineNumber) });
			}
		}
		return model!;
	}
}

interface ICommandWithEditorLine { command: ITerminalCommand; lineNumber: number }

