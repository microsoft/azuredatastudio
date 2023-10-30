/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { timeout } from 'vs/base/common/async';
import { debounce } from 'vs/base/common/decorators';
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { isWindows, platform } from 'vs/base/common/platform';
import { TerminalShellType, WindowsShellType } from 'vs/platform/terminal/common/terminal';
import type * as WindowsProcessTreeType from '@vscode/windows-process-tree';

export interface IWindowsShellHelper extends IDisposable {
	readonly onShellNameChanged: Event<string>;
	readonly onShellTypeChanged: Event<TerminalShellType | undefined>;
	getShellType(title: string): TerminalShellType | undefined;
	getShellName(): Promise<string>;
}

const SHELL_EXECUTABLES = [
	'cmd.exe',
	'powershell.exe',
	'pwsh.exe',
	'bash.exe',
	'wsl.exe',
	'ubuntu.exe',
	'ubuntu1804.exe',
	'kali.exe',
	'debian.exe',
	'opensuse-42.exe',
	'sles-12.exe'
];

let windowsProcessTree: typeof WindowsProcessTreeType;

export class WindowsShellHelper extends Disposable implements IWindowsShellHelper {
	private _isDisposed: boolean;
	private _currentRequest: Promise<string> | undefined;
	private _shellType: TerminalShellType | undefined;
	get shellType(): TerminalShellType | undefined { return this._shellType; }
	private _shellTitle: string = '';
	get shellTitle(): string { return this._shellTitle; }
	private readonly _onShellNameChanged = new Emitter<string>();
	get onShellNameChanged(): Event<string> { return this._onShellNameChanged.event; }
	private readonly _onShellTypeChanged = new Emitter<TerminalShellType | undefined>();
	get onShellTypeChanged(): Event<TerminalShellType | undefined> { return this._onShellTypeChanged.event; }

	constructor(
		private _rootProcessId: number
	) {
		super();

		if (!isWindows) {
			throw new Error(`WindowsShellHelper cannot be instantiated on ${platform}`);
		}

		this._isDisposed = false;

		this._startMonitoringShell();
	}

	private async _startMonitoringShell(): Promise<void> {
		if (this._isDisposed) {
			return;
		}
		this.checkShell();
	}

	@debounce(500)
	async checkShell(): Promise<void> {
		if (isWindows) {
			// Wait to give the shell some time to actually launch a process, this
			// could lead to a race condition but it would be recovered from when
			// data stops and should cover the majority of cases
			await timeout(300);
			this.getShellName().then(title => {
				const type = this.getShellType(title);
				if (type !== this._shellType) {
					this._onShellTypeChanged.fire(type);
					this._onShellNameChanged.fire(title);
					this._shellType = type;
					this._shellTitle = title;
				}
			});
		}
	}

	private traverseTree(tree: any): string {
		if (!tree) {
			return '';
		}
		if (SHELL_EXECUTABLES.indexOf(tree.name) === -1) {
			return tree.name;
		}
		if (!tree.children || tree.children.length === 0) {
			return tree.name;
		}
		let favouriteChild = 0;
		for (; favouriteChild < tree.children.length; favouriteChild++) {
			const child = tree.children[favouriteChild];
			if (!child.children || child.children.length === 0) {
				break;
			}
			if (child.children[0].name !== 'conhost.exe') {
				break;
			}
		}
		if (favouriteChild >= tree.children.length) {
			return tree.name;
		}
		return this.traverseTree(tree.children[favouriteChild]);
	}

	override dispose(): void {
		this._isDisposed = true;
		super.dispose();
	}

	/**
	 * Returns the innermost shell executable running in the terminal
	 */
	async getShellName(): Promise<string> {
		if (this._isDisposed) {
			return Promise.resolve('');
		}
		// Prevent multiple requests at once, instead return current request
		if (this._currentRequest) {
			return this._currentRequest;
		}
		if (!windowsProcessTree) {
			windowsProcessTree = await import('@vscode/windows-process-tree');
		}
		this._currentRequest = new Promise<string>(resolve => {
			windowsProcessTree.getProcessTree(this._rootProcessId, tree => {
				const name = this.traverseTree(tree);
				this._currentRequest = undefined;
				resolve(name);
			});
		});
		return this._currentRequest;
	}

	getShellType(executable: string): TerminalShellType | undefined {
		switch (executable.toLowerCase()) {
			case 'cmd.exe':
				return WindowsShellType.CommandPrompt;
			case 'powershell.exe':
			case 'pwsh.exe':
				return WindowsShellType.PowerShell;
			case 'bash.exe':
			case 'git-cmd.exe':
				return WindowsShellType.GitBash;
			case 'wsl.exe':
			case 'ubuntu.exe':
			case 'ubuntu1804.exe':
			case 'kali.exe':
			case 'debian.exe':
			case 'opensuse-42.exe':
			case 'sles-12.exe':
				return WindowsShellType.Wsl;
			default:
				return undefined;
		}
	}
}
