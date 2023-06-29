/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Emitter, Event } from 'vs/base/common/event';
import { IProcessDataEvent, IProcessProperty, IProcessPropertyMap, IShellLaunchConfig, ITerminalChildProcess, ITerminalLaunchError, ProcessPropertyType } from 'vs/platform/terminal/common/terminal';
import { Disposable } from 'vs/base/common/lifecycle';

export const IEmbedderTerminalService = createDecorator<IEmbedderTerminalService>('embedderTerminalService');

/**
 * Manages terminals that the embedder can create before the terminal contrib is available.
 */
export interface IEmbedderTerminalService {
	readonly _serviceBrand: undefined;

	readonly onDidCreateTerminal: Event<IShellLaunchConfig>;

	createTerminal(options: IEmbedderTerminalOptions): void;
}

export type EmbedderTerminal = IShellLaunchConfig & Required<Pick<IShellLaunchConfig, 'customPtyImplementation'>>;

export interface IEmbedderTerminalOptions {
	name: string;
	pty: IEmbedderTerminalPty;

	// Extension APIs that have not been implemented for embedders:
	//   iconPath?: URI | { light: URI; dark: URI } | ThemeIcon;
	//   color?: ThemeColor;
	//   location?: TerminalLocation | TerminalEditorLocationOptions | TerminalSplitLocationOptions;
	//   isTransient?: boolean;
}

/**
 * See Pseudoterminal on the vscode API for usage.
 */
export interface IEmbedderTerminalPty {
	onDidWrite: Event<string>;
	onDidClose?: Event<void | number>;
	onDidChangeName?: Event<string>;

	open(): void;
	close(): void;

	// Extension APIs that have not been implemented for embedders:
	//   onDidOverrideDimensions?: Event<TerminalDimensions | undefined>;
	//   handleInput?(data: string): void;
	//   setDimensions?(dimensions: TerminalDimensions): void;
}

class EmbedderTerminalService implements IEmbedderTerminalService {
	declare _serviceBrand: undefined;

	private readonly _onDidCreateTerminal = new Emitter<IShellLaunchConfig>();
	readonly onDidCreateTerminal = Event.buffer(this._onDidCreateTerminal.event);

	createTerminal(options: IEmbedderTerminalOptions): void {
		const slc: EmbedderTerminal = {
			name: options.name,
			isFeatureTerminal: true,
			customPtyImplementation(terminalId, cols, rows) {
				return new EmbedderTerminalProcess(terminalId, options.pty);
			},
		};
		this._onDidCreateTerminal.fire(slc);
	}
}


class EmbedderTerminalProcess extends Disposable implements ITerminalChildProcess {
	readonly #pty: IEmbedderTerminalPty;

	readonly shouldPersist = false;

	readonly onProcessData: Event<IProcessDataEvent | string>;
	readonly #onProcessReady = this._register(new Emitter<{ pid: number; cwd: string }>());
	readonly onProcessReady = this.#onProcessReady.event;
	readonly #onDidChangeProperty = this._register(new Emitter<IProcessProperty<any>>());
	readonly onDidChangeProperty = this.#onDidChangeProperty.event;
	readonly #onProcessExit = this._register(new Emitter<number | undefined>());
	readonly onProcessExit = this.#onProcessExit.event;

	constructor(
		readonly id: number,
		pty: IEmbedderTerminalPty
	) {
		super();

		this.#pty = pty;
		this.onProcessData = this.#pty.onDidWrite;
		if (this.#pty.onDidClose) {
			this._register(this.#pty.onDidClose(e => this.#onProcessExit.fire(e || undefined)));
		}
		if (this.#pty.onDidChangeName) {
			this._register(this.#pty.onDidChangeName(e => this.#onDidChangeProperty.fire({
				type: ProcessPropertyType.Title,
				value: e
			})));
		}
	}

	async start(): Promise<ITerminalLaunchError | undefined> {
		this.#onProcessReady.fire({ pid: -1, cwd: '' });
		this.#pty.open();
		return undefined;
	}
	shutdown(): void {
		this.#pty.close();
	}

	// TODO: A lot of these aren't useful for some implementations of ITerminalChildProcess, should
	// they be optional? Should there be a base class for "external" consumers to implement?

	input(): void {
		// not supported
	}
	async processBinary(): Promise<void> {
		// not supported
	}
	resize(): void {
		// no-op
	}
	acknowledgeDataEvent(): void {
		// no-op, flow control not currently implemented
	}
	async setUnicodeVersion(): Promise<void> {
		// no-op
	}
	async getInitialCwd(): Promise<string> {
		return '';
	}
	async getCwd(): Promise<string> {
		return '';
	}
	async getLatency(): Promise<number> {
		return 0;
	}
	refreshProperty<T extends ProcessPropertyType>(property: ProcessPropertyType): Promise<IProcessPropertyMap[T]> {
		throw new Error(`refreshProperty is not suppported in EmbedderTerminalProcess. property: ${property}`);
	}

	updateProperty(property: ProcessPropertyType, value: any): Promise<void> {
		throw new Error(`updateProperty is not suppported in EmbedderTerminalProcess. property: ${property}, value: ${value}`);
	}
}

registerSingleton(IEmbedderTerminalService, EmbedderTerminalService, InstantiationType.Delayed);
