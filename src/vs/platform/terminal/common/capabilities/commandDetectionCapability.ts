/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { timeout } from 'vs/base/common/async';
import { debounce } from 'vs/base/common/decorators';
import { Emitter } from 'vs/base/common/event';
import { ILogService } from 'vs/platform/log/common/log';
import { ICommandDetectionCapability, TerminalCapability, ITerminalCommand, IHandleCommandOptions, ICommandInvalidationRequest, CommandInvalidationReason, ISerializedTerminalCommand, ISerializedCommandDetectionCapability } from 'vs/platform/terminal/common/capabilities/capabilities';
import { ITerminalOutputMatch, ITerminalOutputMatcher } from 'vs/platform/terminal/common/terminal';

// Importing types is safe in any layer
// eslint-disable-next-line local/code-import-patterns
import type { IBuffer, IBufferLine, IDisposable, IMarker, Terminal } from 'xterm-headless';

export interface ICurrentPartialCommand {
	previousCommandMarker?: IMarker;

	promptStartMarker?: IMarker;

	commandStartMarker?: IMarker;
	commandStartX?: number;
	commandStartLineContent?: string;

	commandRightPromptStartX?: number;
	commandRightPromptEndX?: number;

	commandLines?: IMarker;

	commandExecutedMarker?: IMarker;
	commandExecutedX?: number;

	commandFinishedMarker?: IMarker;

	currentContinuationMarker?: IMarker;
	continuations?: { marker: IMarker; end: number }[];

	command?: string;

	/**
	 * Whether the command line is trusted via a nonce.
	 */
	isTrusted?: boolean;

	/**
	 * Something invalidated the command before it finished, this will prevent the onCommandFinished
	 * event from firing.
	 */
	isInvalid?: boolean;
}

interface ITerminalDimensions {
	cols: number;
	rows: number;
}

export class CommandDetectionCapability implements ICommandDetectionCapability {
	readonly type = TerminalCapability.CommandDetection;

	protected _commands: ITerminalCommand[] = [];
	private _exitCode: number | undefined;
	private _cwd: string | undefined;
	private _currentCommand: ICurrentPartialCommand = {};
	private _isWindowsPty: boolean = false;
	private _onCursorMoveListener?: IDisposable;
	private _commandMarkers: IMarker[] = [];
	private _dimensions: ITerminalDimensions;
	private __isCommandStorageDisabled: boolean = false;
	private _handleCommandStartOptions?: IHandleCommandOptions;

	get commands(): readonly ITerminalCommand[] { return this._commands; }
	get executingCommand(): string | undefined { return this._currentCommand.command; }
	// TODO: as is unsafe here and it duplicates behavor of executingCommand
	get executingCommandObject(): ITerminalCommand | undefined {
		if (this._currentCommand.commandStartMarker) {
			return { marker: this._currentCommand.commandStartMarker } as ITerminalCommand;
		}
		return undefined;
	}
	get cwd(): string | undefined { return this._cwd; }
	private get _isInputting(): boolean {
		return !!(this._currentCommand.commandStartMarker && !this._currentCommand.commandExecutedMarker);
	}

	get hasInput(): boolean | undefined {
		if (!this._isInputting || !this._currentCommand?.commandStartMarker) {
			return undefined;
		}
		if (this._terminal.buffer.active.baseY + this._terminal.buffer.active.cursorY === this._currentCommand.commandStartMarker?.line) {
			const line = this._terminal.buffer.active.getLine(this._terminal.buffer.active.cursorY)?.translateToString(true, this._currentCommand.commandStartX);
			if (line === undefined) {
				return undefined;
			}
			return line.length > 0;
		}
		return true;
	}

	private readonly _onCommandStarted = new Emitter<ITerminalCommand>();
	readonly onCommandStarted = this._onCommandStarted.event;
	private readonly _onBeforeCommandFinished = new Emitter<ITerminalCommand>();
	readonly onBeforeCommandFinished = this._onBeforeCommandFinished.event;
	private readonly _onCommandFinished = new Emitter<ITerminalCommand>();
	readonly onCommandFinished = this._onCommandFinished.event;
	private readonly _onCommandExecuted = new Emitter<void>();
	readonly onCommandExecuted = this._onCommandExecuted.event;
	private readonly _onCommandInvalidated = new Emitter<ITerminalCommand[]>();
	readonly onCommandInvalidated = this._onCommandInvalidated.event;
	private readonly _onCurrentCommandInvalidated = new Emitter<ICommandInvalidationRequest>();
	readonly onCurrentCommandInvalidated = this._onCurrentCommandInvalidated.event;

	constructor(
		private readonly _terminal: Terminal,
		@ILogService private readonly _logService: ILogService
	) {
		this._dimensions = {
			cols: this._terminal.cols,
			rows: this._terminal.rows
		};
		this._terminal.onResize(e => this._handleResize(e));
		this._terminal.onCursorMove(() => this._handleCursorMove());
		this._setupClearListeners();
	}

	private _handleResize(e: { cols: number; rows: number }) {
		if (this._isWindowsPty) {
			this._preHandleResizeWindows(e);
		}
		this._dimensions.cols = e.cols;
		this._dimensions.rows = e.rows;
	}

	@debounce(500)
	private _handleCursorMove() {
		// Early versions of conpty do not have real support for an alt buffer, in addition certain
		// commands such as tsc watch will write to the top of the normal buffer. The following
		// checks when the cursor has moved while the normal buffer is empty and if it is above the
		// current command, all decorations within the viewport will be invalidated.
		//
		// This function is debounced so that the cursor is only checked when it is stable so
		// conpty's screen reprinting will not trigger decoration clearing.
		//
		// This is mostly a workaround for Windows but applies to all OS' because of the tsc watch
		// case.
		if (this._terminal.buffer.active === this._terminal.buffer.normal && this._currentCommand.commandStartMarker) {
			if (this._terminal.buffer.active.baseY + this._terminal.buffer.active.cursorY < this._currentCommand.commandStartMarker.line) {
				this._clearCommandsInViewport();
				this._currentCommand.isInvalid = true;
				this._onCurrentCommandInvalidated.fire({ reason: CommandInvalidationReason.Windows });
			}
		}
	}

	private _setupClearListeners() {
		// Setup listeners for when clear is run in the shell. Since we don't know immediately if
		// this is a Windows pty, listen to both routes and do the Windows check inside them

		// For a Windows backend we cannot listen to CSI J, instead we assume running clear or
		// cls will clear all commands in the viewport. This is not perfect but it's right most
		// of the time.
		this.onBeforeCommandFinished(command => {
			if (this._isWindowsPty) {
				if (command.command.trim().toLowerCase() === 'clear' || command.command.trim().toLowerCase() === 'cls') {
					this._clearCommandsInViewport();
					this._currentCommand.isInvalid = true;
					this._onCurrentCommandInvalidated.fire({ reason: CommandInvalidationReason.Windows });
				}
			}
		});

		// For non-Windows backends we can just listen to CSI J which is what the clear command
		// typically emits.
		this._terminal.parser.registerCsiHandler({ final: 'J' }, params => {
			if (!this._isWindowsPty) {
				if (params.length >= 1 && (params[0] === 2 || params[0] === 3)) {
					this._clearCommandsInViewport();
				}
			}
			// We don't want to override xterm.js' default behavior, just augment it
			return false;
		});
	}

	private _preHandleResizeWindows(e: { cols: number; rows: number }) {
		// Resize behavior is different under conpty; instead of bringing parts of the scrollback
		// back into the viewport, new lines are inserted at the bottom (ie. the same behavior as if
		// there was no scrollback).
		//
		// On resize this workaround will wait for a conpty reprint to occur by waiting for the
		// cursor to move, it will then calculate the number of lines that the commands within the
		// viewport _may have_ shifted. After verifying the content of the current line is
		// incorrect, the line after shifting is checked and if that matches delete events are fired
		// on the xterm.js buffer to move the markers.
		//
		// While a bit hacky, this approach is quite safe and seems to work great at least for pwsh.
		const baseY = this._terminal.buffer.active.baseY;
		const rowsDifference = e.rows - this._dimensions.rows;
		// Only do when rows increase, do in the next frame as this needs to happen after
		// conpty reprints the screen
		if (rowsDifference > 0) {
			this._waitForCursorMove().then(() => {
				// Calculate the number of lines the content may have shifted, this will max out at
				// scrollback count since the standard behavior will be used then
				const potentialShiftedLineCount = Math.min(rowsDifference, baseY);
				// For each command within the viewport, assume commands are in the correct order
				for (let i = this.commands.length - 1; i >= 0; i--) {
					const command = this.commands[i];
					if (!command.marker || command.marker.line < baseY || command.commandStartLineContent === undefined) {
						break;
					}
					const line = this._terminal.buffer.active.getLine(command.marker.line);
					if (!line || line.translateToString(true) === command.commandStartLineContent) {
						continue;
					}
					const shiftedY = command.marker.line - potentialShiftedLineCount;
					const shiftedLine = this._terminal.buffer.active.getLine(shiftedY);
					if (shiftedLine?.translateToString(true) !== command.commandStartLineContent) {
						continue;
					}
					// HACK: xterm.js doesn't expose this by design as it's an internal core
					// function an embedder could easily do damage with. Additionally, this
					// can't really be upstreamed since the event relies on shell integration to
					// verify the shifting is necessary.
					(this._terminal as any)._core._bufferService.buffer.lines.onDeleteEmitter.fire({
						index: this._terminal.buffer.active.baseY,
						amount: potentialShiftedLineCount
					});
				}
			});
		}
	}

	private _clearCommandsInViewport(): void {
		// Find the number of commands on the tail end of the array that are within the viewport
		let count = 0;
		for (let i = this._commands.length - 1; i >= 0; i--) {
			const line = this._commands[i].marker?.line;
			if (line && line < this._terminal.buffer.active.baseY) {
				break;
			}
			count++;
		}
		// Remove them
		if (count > 0) {
			this._onCommandInvalidated.fire(this._commands.splice(this._commands.length - count, count));
		}
	}

	private _waitForCursorMove(): Promise<void> {
		const cursorX = this._terminal.buffer.active.cursorX;
		const cursorY = this._terminal.buffer.active.cursorY;
		let totalDelay = 0;
		return new Promise<void>((resolve, reject) => {
			const interval = setInterval(() => {
				if (cursorX !== this._terminal.buffer.active.cursorX || cursorY !== this._terminal.buffer.active.cursorY) {
					resolve();
					clearInterval(interval);
					return;
				}
				totalDelay += 10;
				if (totalDelay > 1000) {
					clearInterval(interval);
					resolve();
				}
			}, 10);
		});
	}

	setCwd(value: string) {
		this._cwd = value;
	}

	setIsWindowsPty(value: boolean) {
		this._isWindowsPty = value;
	}

	setIsCommandStorageDisabled(): void {
		this.__isCommandStorageDisabled = true;
	}

	getCwdForLine(line: number): string | undefined {
		// Handle the current partial command first, anything below it's prompt is considered part
		// of the current command
		if (this._currentCommand.promptStartMarker && line >= this._currentCommand.promptStartMarker?.line) {
			return this._cwd;
		}
		// TODO: It would be more reliable to take the closest cwd above the line if it isn't found for the line
		// TODO: Use a reverse for loop to find the line to avoid creating another array
		const reversed = [...this._commands].reverse();
		return reversed.find(c => c.marker!.line <= line - 1)?.cwd;
	}

	handlePromptStart(options?: IHandleCommandOptions): void {
		this._currentCommand.promptStartMarker = options?.marker || this._terminal.registerMarker(0);
		this._logService.debug('CommandDetectionCapability#handlePromptStart', this._terminal.buffer.active.cursorX, this._currentCommand.promptStartMarker?.line);
	}

	handleContinuationStart(): void {
		this._currentCommand.currentContinuationMarker = this._terminal.registerMarker(0);
		this._logService.debug('CommandDetectionCapability#handleContinuationStart', this._currentCommand.currentContinuationMarker);
	}

	handleContinuationEnd(): void {
		if (!this._currentCommand.currentContinuationMarker) {
			this._logService.warn('CommandDetectionCapability#handleContinuationEnd Received continuation end without start');
			return;
		}
		if (!this._currentCommand.continuations) {
			this._currentCommand.continuations = [];
		}
		this._currentCommand.continuations.push({
			marker: this._currentCommand.currentContinuationMarker,
			end: this._terminal.buffer.active.cursorX
		});
		this._currentCommand.currentContinuationMarker = undefined;
		this._logService.debug('CommandDetectionCapability#handleContinuationEnd', this._currentCommand.continuations[this._currentCommand.continuations.length - 1]);
	}

	handleRightPromptStart(): void {
		this._currentCommand.commandRightPromptStartX = this._terminal.buffer.active.cursorX;
		this._logService.debug('CommandDetectionCapability#handleRightPromptStart', this._currentCommand.commandRightPromptStartX);
	}

	handleRightPromptEnd(): void {
		this._currentCommand.commandRightPromptEndX = this._terminal.buffer.active.cursorX;
		this._logService.debug('CommandDetectionCapability#handleRightPromptEnd', this._currentCommand.commandRightPromptEndX);
	}

	handleCommandStart(options?: IHandleCommandOptions): void {
		this._handleCommandStartOptions = options;
		// Only update the column if the line has already been set
		this._currentCommand.commandStartMarker = options?.marker || this._currentCommand.commandStartMarker;
		if (this._currentCommand.commandStartMarker?.line === this._terminal.buffer.active.cursorY) {
			this._currentCommand.commandStartX = this._terminal.buffer.active.cursorX;
			this._logService.debug('CommandDetectionCapability#handleCommandStart', this._currentCommand.commandStartX, this._currentCommand.commandStartMarker?.line);
			return;
		}
		if (this._isWindowsPty) {
			this._handleCommandStartWindows();
			return;
		}
		this._currentCommand.commandStartX = this._terminal.buffer.active.cursorX;
		this._currentCommand.commandStartMarker = options?.marker || this._terminal.registerMarker(0);

		// Clear executed as it must happen after command start
		this._currentCommand.commandExecutedMarker?.dispose();
		this._currentCommand.commandExecutedMarker = undefined;
		this._currentCommand.commandExecutedX = undefined;
		for (const m of this._commandMarkers) {
			m.dispose();
		}
		this._commandMarkers.length = 0;

		this._onCommandStarted.fire({ marker: options?.marker || this._currentCommand.commandStartMarker, markProperties: options?.markProperties } as ITerminalCommand);
		this._logService.debug('CommandDetectionCapability#handleCommandStart', this._currentCommand.commandStartX, this._currentCommand.commandStartMarker?.line);
	}

	private _handleCommandStartWindows(): void {
		this._currentCommand.commandStartX = this._terminal.buffer.active.cursorX;

		// On Windows track all cursor movements after the command start sequence
		this._commandMarkers.length = 0;
		// HACK: Fire command started on the following frame on Windows to allow the cursor
		// position to update as conpty often prints the sequence on a different line to the
		// actual line the command started on.
		timeout(0).then(() => {
			if (!this._currentCommand.commandExecutedMarker) {
				this._onCursorMoveListener = this._terminal.onCursorMove(() => {
					if (this._commandMarkers.length === 0 || this._commandMarkers[this._commandMarkers.length - 1].line !== this._terminal.buffer.active.cursorY) {
						const marker = this._terminal.registerMarker(0);
						if (marker) {
							this._commandMarkers.push(marker);
						}
					}
				});
			}
			this._currentCommand.commandStartMarker = this._terminal.registerMarker(0);
			if (this._currentCommand.commandStartMarker) {
				const line = this._terminal.buffer.active.getLine(this._currentCommand.commandStartMarker.line);
				if (line) {
					this._currentCommand.commandStartLineContent = line.translateToString(true);
				}
			}
			this._onCommandStarted.fire({ marker: this._currentCommand.commandStartMarker } as ITerminalCommand);
			this._logService.debug('CommandDetectionCapability#_handleCommandStartWindows', this._currentCommand.commandStartX, this._currentCommand.commandStartMarker?.line);
		});
	}

	handleGenericCommand(options?: IHandleCommandOptions): void {
		if (options?.markProperties?.disableCommandStorage) {
			this.setIsCommandStorageDisabled();
		}
		this.handlePromptStart(options);
		this.handleCommandStart(options);
		this.handleCommandExecuted(options);
		this.handleCommandFinished(undefined, options);
	}

	handleCommandExecuted(options?: IHandleCommandOptions): void {
		if (this._isWindowsPty) {
			this._handleCommandExecutedWindows();
			return;
		}

		this._currentCommand.commandExecutedMarker = options?.marker || this._terminal.registerMarker(0);
		this._currentCommand.commandExecutedX = this._terminal.buffer.active.cursorX;
		this._logService.debug('CommandDetectionCapability#handleCommandExecuted', this._currentCommand.commandExecutedX, this._currentCommand.commandExecutedMarker?.line);

		// Sanity check optional props
		if (!this._currentCommand.commandStartMarker || !this._currentCommand.commandExecutedMarker || this._currentCommand.commandStartX === undefined) {
			return;
		}

		// Calculate the command
		this._currentCommand.command = this.__isCommandStorageDisabled ? '' : this._terminal.buffer.active.getLine(this._currentCommand.commandStartMarker.line)?.translateToString(true, this._currentCommand.commandStartX, this._currentCommand.commandRightPromptStartX).trim();
		let y = this._currentCommand.commandStartMarker.line + 1;
		const commandExecutedLine = this._currentCommand.commandExecutedMarker.line;
		for (; y < commandExecutedLine; y++) {
			const line = this._terminal.buffer.active.getLine(y);
			if (line) {
				const continuation = this._currentCommand.continuations?.find(e => e.marker.line === y);
				if (continuation) {
					this._currentCommand.command += '\n';
				}
				const startColumn = continuation?.end ?? 0;
				this._currentCommand.command += line.translateToString(true, startColumn);
			}
		}
		if (y === commandExecutedLine) {
			this._currentCommand.command += this._terminal.buffer.active.getLine(commandExecutedLine)?.translateToString(true, undefined, this._currentCommand.commandExecutedX) || '';
		}
		this._onCommandExecuted.fire();
	}

	private _handleCommandExecutedWindows(): void {
		// On Windows, use the gathered cursor move markers to correct the command start and
		// executed markers
		this._onCursorMoveListener?.dispose();
		this._onCursorMoveListener = undefined;
		this._evaluateCommandMarkersWindows();
		this._currentCommand.commandExecutedX = this._terminal.buffer.active.cursorX;
		this._onCommandExecuted.fire();
		this._logService.debug('CommandDetectionCapability#handleCommandExecuted', this._currentCommand.commandExecutedX, this._currentCommand.commandExecutedMarker?.line);
	}

	invalidateCurrentCommand(request: ICommandInvalidationRequest): void {
		this._currentCommand.isInvalid = true;
		this._onCurrentCommandInvalidated.fire(request);
	}

	handleCommandFinished(exitCode: number | undefined, options?: IHandleCommandOptions): void {
		if (this._isWindowsPty) {
			this._preHandleCommandFinishedWindows();
		}

		this._currentCommand.commandFinishedMarker = options?.marker || this._terminal.registerMarker(0);
		let command = this._currentCommand.command;
		this._logService.debug('CommandDetectionCapability#handleCommandFinished', this._terminal.buffer.active.cursorX, this._currentCommand.commandFinishedMarker?.line, this._currentCommand.command, this._currentCommand);
		this._exitCode = exitCode;

		// HACK: Handle a special case on some versions of bash where identical commands get merged
		// in the output of `history`, this detects that case and sets the exit code to the the last
		// command's exit code. This covered the majority of cases but will fail if the same command
		// runs with a different exit code, that will need a more robust fix where we send the
		// command ID and exit code over to the capability to adjust there.
		if (this._exitCode === undefined) {
			const lastCommand = this.commands.length > 0 ? this.commands[this.commands.length - 1] : undefined;
			if (command && command.length > 0 && lastCommand?.command === command) {
				this._exitCode = lastCommand.exitCode;
			}
		}

		if (this._currentCommand.commandStartMarker === undefined || !this._terminal.buffer.active) {
			return;
		}

		// When the command finishes and executed never fires the placeholder selector should be used.
		if (this._exitCode === undefined && command === undefined) {
			command = '';
		}

		if ((command !== undefined && !command.startsWith('\\')) || this._handleCommandStartOptions?.ignoreCommandLine) {
			const buffer = this._terminal.buffer.active;
			const timestamp = Date.now();
			const executedMarker = this._currentCommand.commandExecutedMarker;
			const endMarker = this._currentCommand.commandFinishedMarker;
			const newCommand: ITerminalCommand = {
				command: this._handleCommandStartOptions?.ignoreCommandLine ? '' : (command || ''),
				isTrusted: !!this._currentCommand.isTrusted,
				marker: this._currentCommand.commandStartMarker,
				endMarker,
				executedMarker,
				timestamp,
				cwd: this._cwd,
				exitCode: this._exitCode,
				commandStartLineContent: this._currentCommand.commandStartLineContent,
				hasOutput: () => !executedMarker?.isDisposed && !endMarker?.isDisposed && !!(executedMarker && endMarker && executedMarker?.line < endMarker!.line),
				getOutput: () => getOutputForCommand(executedMarker, endMarker, buffer),
				getOutputMatch: (outputMatcher: ITerminalOutputMatcher) => getOutputMatchForCommand(this._isWindowsPty && (executedMarker?.line === endMarker?.line) ? this._currentCommand.commandStartMarker : executedMarker, endMarker, buffer, this._terminal.cols, outputMatcher),
				markProperties: options?.markProperties
			};
			this._commands.push(newCommand);
			this._logService.debug('CommandDetectionCapability#onCommandFinished', newCommand);

			this._onBeforeCommandFinished.fire(newCommand);
			if (!this._currentCommand.isInvalid) {
				this._onCommandFinished.fire(newCommand);
			}
		}
		this._currentCommand.previousCommandMarker = this._currentCommand.commandStartMarker;
		this._currentCommand = {};
		this._handleCommandStartOptions = undefined;
	}

	private _preHandleCommandFinishedWindows(): void {
		if (this._currentCommand.commandExecutedMarker) {
			return;
		}
		// This is done on command finished just in case command executed never happens (for example
		// PSReadLine tab completion)
		if (this._commandMarkers.length === 0) {
			// If the command start timeout doesn't happen before command finished, just use the
			// current marker.
			if (!this._currentCommand.commandStartMarker) {
				this._currentCommand.commandStartMarker = this._terminal.registerMarker(0);
			}
			if (this._currentCommand.commandStartMarker) {
				this._commandMarkers.push(this._currentCommand.commandStartMarker);
			}
		}
		this._evaluateCommandMarkersWindows();
	}

	private _evaluateCommandMarkersWindows(): void {
		// On Windows, use the gathered cursor move markers to correct the command start and
		// executed markers.
		if (this._commandMarkers.length === 0) {
			return;
		}
		this._commandMarkers = this._commandMarkers.sort((a, b) => a.line - b.line);
		this._currentCommand.commandStartMarker = this._commandMarkers[0];
		if (this._currentCommand.commandStartMarker) {
			const line = this._terminal.buffer.active.getLine(this._currentCommand.commandStartMarker.line);
			if (line) {
				this._currentCommand.commandStartLineContent = line.translateToString(true);
			}
		}
		this._currentCommand.commandExecutedMarker = this._commandMarkers[this._commandMarkers.length - 1];
	}

	setCommandLine(commandLine: string, isTrusted: boolean) {
		this._logService.debug('CommandDetectionCapability#setCommandLine', commandLine, isTrusted);
		this._currentCommand.command = commandLine;
		this._currentCommand.isTrusted = isTrusted;
	}

	serialize(): ISerializedCommandDetectionCapability {
		const commands: ISerializedTerminalCommand[] = this.commands.map(e => {
			return {
				startLine: e.marker?.line,
				startX: undefined,
				endLine: e.endMarker?.line,
				executedLine: e.executedMarker?.line,
				command: this.__isCommandStorageDisabled ? '' : e.command,
				isTrusted: e.isTrusted,
				cwd: e.cwd,
				exitCode: e.exitCode,
				commandStartLineContent: e.commandStartLineContent,
				timestamp: e.timestamp,
				markProperties: e.markProperties,
				aliases: e.aliases
			};
		});
		if (this._currentCommand.commandStartMarker) {
			commands.push({
				startLine: this._currentCommand.commandStartMarker.line,
				startX: this._currentCommand.commandStartX,
				endLine: undefined,
				executedLine: undefined,
				command: '',
				isTrusted: true,
				cwd: this._cwd,
				exitCode: undefined,
				commandStartLineContent: undefined,
				timestamp: 0,
				markProperties: undefined
			});
		}
		return {
			isWindowsPty: this._isWindowsPty,
			commands
		};
	}

	deserialize(serialized: ISerializedCommandDetectionCapability): void {
		if (serialized.isWindowsPty) {
			this.setIsWindowsPty(serialized.isWindowsPty);
		}
		const buffer = this._terminal.buffer.normal;
		for (const e of serialized.commands) {
			const marker = e.startLine !== undefined ? this._terminal.registerMarker(e.startLine - (buffer.baseY + buffer.cursorY)) : undefined;
			// Check for invalid command
			if (!marker) {
				continue;
			}
			// Partial command
			if (!e.endLine) {
				this._currentCommand.commandStartMarker = marker;
				this._currentCommand.commandStartX = e.startX;
				this._cwd = e.cwd;
				this._onCommandStarted.fire({ marker } as ITerminalCommand);
				continue;
			}
			// Full command
			const endMarker = e.endLine !== undefined ? this._terminal.registerMarker(e.endLine - (buffer.baseY + buffer.cursorY)) : undefined;
			const executedMarker = e.executedLine !== undefined ? this._terminal.registerMarker(e.executedLine - (buffer.baseY + buffer.cursorY)) : undefined;
			const newCommand: ITerminalCommand = {
				command: this.__isCommandStorageDisabled ? '' : e.command,
				isTrusted: e.isTrusted,
				marker,
				endMarker,
				executedMarker,
				timestamp: e.timestamp,
				cwd: e.cwd,
				commandStartLineContent: e.commandStartLineContent,
				exitCode: e.exitCode,
				hasOutput: () => !executedMarker?.isDisposed && !endMarker?.isDisposed && !!(executedMarker && endMarker && executedMarker.line < endMarker.line),
				getOutput: () => getOutputForCommand(executedMarker, endMarker, buffer),
				getOutputMatch: (outputMatcher: ITerminalOutputMatcher) => getOutputMatchForCommand(this._isWindowsPty && (executedMarker?.line === endMarker?.line) ? marker : executedMarker, endMarker, buffer, this._terminal.cols, outputMatcher),
				markProperties: e.markProperties,
				wasReplayed: true
			};
			this._commands.push(newCommand);
			this._logService.debug('CommandDetectionCapability#onCommandFinished', newCommand);
			this._onCommandFinished.fire(newCommand);
		}
	}
}

function getOutputForCommand(executedMarker: IMarker | undefined, endMarker: IMarker | undefined, buffer: IBuffer): string | undefined {
	if (!executedMarker || !endMarker) {
		return undefined;
	}
	const startLine = executedMarker.line;
	const endLine = endMarker.line;

	if (startLine === endLine) {
		return undefined;
	}
	let output = '';
	let line: IBufferLine | undefined;
	for (let i = startLine; i < endLine; i++) {
		line = buffer.getLine(i);
		if (!line) {
			continue;
		}
		output += line.translateToString(!line.isWrapped) + (line.isWrapped ? '' : '\n');
	}
	return output === '' ? undefined : output;
}

function getOutputMatchForCommand(executedMarker: IMarker | undefined, endMarker: IMarker | undefined, buffer: IBuffer, cols: number, outputMatcher: ITerminalOutputMatcher): ITerminalOutputMatch | undefined {
	if (!executedMarker || !endMarker) {
		return undefined;
	}
	const endLine = endMarker.line;
	if (endLine === -1) {
		return undefined;
	}
	const startLine = Math.max(executedMarker.line, 0);
	const matcher = outputMatcher.lineMatcher;
	const linesToCheck = typeof matcher === 'string' ? 1 : outputMatcher.length || countNewLines(matcher);
	const lines: string[] = [];
	let match: RegExpMatchArray | null | undefined;
	if (outputMatcher.anchor === 'bottom') {
		for (let i = endLine - (outputMatcher.offset || 0); i >= startLine; i--) {
			let wrappedLineStart = i;
			const wrappedLineEnd = i;
			while (wrappedLineStart >= startLine && buffer.getLine(wrappedLineStart)?.isWrapped) {
				wrappedLineStart--;
			}
			i = wrappedLineStart;
			lines.unshift(getXtermLineContent(buffer, wrappedLineStart, wrappedLineEnd, cols));
			if (!match) {
				match = lines[0].match(matcher);
			}
			if (lines.length >= linesToCheck) {
				break;
			}
		}
	} else {
		for (let i = startLine + (outputMatcher.offset || 0); i < endLine; i++) {
			const wrappedLineStart = i;
			let wrappedLineEnd = i;
			while (wrappedLineEnd + 1 < endLine && buffer.getLine(wrappedLineEnd + 1)?.isWrapped) {
				wrappedLineEnd++;
			}
			i = wrappedLineEnd;
			lines.push(getXtermLineContent(buffer, wrappedLineStart, wrappedLineEnd, cols));
			if (!match) {
				match = lines[lines.length - 1].match(matcher);
			}
			if (lines.length >= linesToCheck) {
				break;
			}
		}
	}
	return match ? { regexMatch: match, outputLines: lines } : undefined;
}

export function getLinesForCommand(buffer: IBuffer, command: ITerminalCommand, cols: number, outputMatcher?: ITerminalOutputMatcher): string[] | undefined {
	if (!outputMatcher) {
		return undefined;
	}
	const executedMarker = command.executedMarker;
	const endMarker = command.endMarker;
	if (!executedMarker || !endMarker) {
		return undefined;
	}
	const startLine = executedMarker.line;
	const endLine = endMarker.line;

	const linesToCheck = outputMatcher.length;
	const lines: string[] = [];
	if (outputMatcher.anchor === 'bottom') {
		for (let i = endLine - (outputMatcher.offset || 0); i >= startLine; i--) {
			let wrappedLineStart = i;
			const wrappedLineEnd = i;
			while (wrappedLineStart >= startLine && buffer.getLine(wrappedLineStart)?.isWrapped) {
				wrappedLineStart--;
			}
			i = wrappedLineStart;
			lines.unshift(getXtermLineContent(buffer, wrappedLineStart, wrappedLineEnd, cols));
			if (lines.length > linesToCheck) {
				lines.pop();
			}
		}
	} else {
		for (let i = startLine + (outputMatcher.offset || 0); i < endLine; i++) {
			const wrappedLineStart = i;
			let wrappedLineEnd = i;
			while (wrappedLineEnd + 1 < endLine && buffer.getLine(wrappedLineEnd + 1)?.isWrapped) {
				wrappedLineEnd++;
			}
			i = wrappedLineEnd;
			lines.push(getXtermLineContent(buffer, wrappedLineStart, wrappedLineEnd, cols));
			if (lines.length === linesToCheck) {
				lines.shift();
			}
		}
	}
	return lines;
}


function getXtermLineContent(buffer: IBuffer, lineStart: number, lineEnd: number, cols: number): string {
	// Cap the maximum number of lines generated to prevent potential performance problems. This is
	// more of a sanity check as the wrapped line should already be trimmed down at this point.
	const maxLineLength = Math.max(2048 / cols * 2);
	lineEnd = Math.min(lineEnd, lineStart + maxLineLength);
	let content = '';
	for (let i = lineStart; i <= lineEnd; i++) {
		// Make sure only 0 to cols are considered as resizing when windows mode is enabled will
		// retain buffer data outside of the terminal width as reflow is disabled.
		const line = buffer.getLine(i);
		if (line) {
			content += line.translateToString(true, 0, cols);
		}
	}
	return content;
}

function countNewLines(regex: RegExp): number {
	if (!regex.multiline) {
		return 1;
	}
	const source = regex.source;
	let count = 1;
	let i = source.indexOf('\\n');
	while (i !== -1) {
		count++;
		i = source.indexOf('\\n', i + 1);
	}
	return count;
}
