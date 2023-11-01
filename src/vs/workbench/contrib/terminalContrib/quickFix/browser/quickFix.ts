/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IAction } from 'vs/base/common/actions';
import { CancellationToken } from 'vs/base/common/cancellation';
import { URI } from 'vs/base/common/uri';
import { ITerminalCommandSelector, ITerminalOutputMatch, ITerminalOutputMatcher } from 'vs/platform/terminal/common/terminal';
import { ITerminalCommand } from 'vs/platform/terminal/common/capabilities/capabilities';

export const ITerminalQuickFixService = createDecorator<ITerminalQuickFixService>('terminalQuickFixService');
export interface ITerminalQuickFixService {
	onDidRegisterProvider: Event<ITerminalQuickFixProviderSelector>;
	onDidRegisterCommandSelector: Event<ITerminalCommandSelector>;
	onDidUnregisterProvider: Event<string>;
	readonly _serviceBrand: undefined;
	readonly extensionQuickFixes: Promise<Array<ITerminalCommandSelector>>;
	providers: Map<string, ITerminalQuickFixProvider>;
	registerQuickFixProvider(id: string, provider: ITerminalQuickFixProvider): IDisposable;
	registerCommandSelector(selector: ITerminalCommandSelector): void;
}

export interface ITerminalQuickFixProviderSelector {
	selector: ITerminalCommandSelector;
	provider: ITerminalQuickFixProvider;
}

export type TerminalQuickFixActionInternal = IAction | ITerminalQuickFixExecuteTerminalCommandAction | ITerminalQuickFixOpenerAction;
export type TerminalQuickFixCallback = (matchResult: ITerminalCommandMatchResult) => TerminalQuickFixActionInternal[] | TerminalQuickFixActionInternal | undefined;
export type TerminalQuickFixCallbackExtension = (terminalCommand: ITerminalCommand, lines: string[] | undefined, option: ITerminalQuickFixOptions, token: CancellationToken) => Promise<ITerminalQuickFix[] | ITerminalQuickFix | undefined>;

export interface ITerminalQuickFixProvider {
	/**
	 * Provides terminal quick fixes
	 * @param commandMatchResult The command match result for which to provide quick fixes
	 * @param token A cancellation token indicating the result is no longer needed
	 * @return Terminal quick fix(es) if any
	 */
	provideTerminalQuickFixes(terminalCommand: ITerminalCommand, lines: string[] | undefined, option: ITerminalQuickFixOptions, token: CancellationToken): Promise<ITerminalQuickFix[] | ITerminalQuickFix | undefined>;
}

export enum TerminalQuickFixType {
	TerminalCommand = 0,
	Opener = 1,
	Port = 2,
	VscodeCommand = 3
}

export interface ITerminalQuickFixOptions {
	type: 'internal' | 'resolved' | 'unresolved';
	id: string;
	commandLineMatcher: string | RegExp;
	outputMatcher?: ITerminalOutputMatcher;
	commandExitResult: 'success' | 'error';
	kind?: 'fix' | 'explain';
}

export interface ITerminalQuickFix {
	type: TerminalQuickFixType;
	id: string;
	source: string;
}

export interface ITerminalQuickFixExecuteTerminalCommandAction extends ITerminalQuickFix {
	type: TerminalQuickFixType.TerminalCommand;
	terminalCommand: string;
	// TODO: Should this depend on whether alt is held?
	addNewLine?: boolean;
}
export interface ITerminalQuickFixOpenerAction extends ITerminalQuickFix {
	type: TerminalQuickFixType.Opener;
	uri: URI;
}
export interface ITerminalQuickFixCommandAction extends ITerminalQuickFix {
	title: string;
}

export interface ITerminalCommandMatchResult {
	commandLine: string;
	commandLineMatch: RegExpMatchArray;
	outputMatch?: ITerminalOutputMatch;
}

export interface ITerminalQuickFixInternalOptions extends ITerminalQuickFixOptions {
	type: 'internal';
	getQuickFixes: TerminalQuickFixCallback;
}

export interface ITerminalQuickFixResolvedExtensionOptions extends ITerminalQuickFixOptions {
	type: 'resolved';
	getQuickFixes: TerminalQuickFixCallbackExtension;
}

export interface ITerminalQuickFixUnresolvedExtensionOptions extends ITerminalQuickFixOptions {
	type: 'unresolved';
}
