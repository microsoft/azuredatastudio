/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { UriComponents } from 'vs/base/common/uri';
import { IRawTerminalTabLayoutInfo, ITerminalEnvironment, ITerminalTabLayoutInfoById, TerminalIcon, TitleEventSource } from 'vs/platform/terminal/common/terminal';
import { ISerializableEnvironmentVariableCollection } from 'vs/platform/terminal/common/environmentVariable';

export interface ISingleTerminalConfiguration<T> {
	userValue: T | undefined;
	value: T | undefined;
	defaultValue: T | undefined;
}

export interface ICompleteTerminalConfiguration {
	'terminal.integrated.automationShell.windows': ISingleTerminalConfiguration<string | string[]>;
	'terminal.integrated.automationShell.osx': ISingleTerminalConfiguration<string | string[]>;
	'terminal.integrated.automationShell.linux': ISingleTerminalConfiguration<string | string[]>;
	'terminal.integrated.shell.windows': ISingleTerminalConfiguration<string | string[]>;
	'terminal.integrated.shell.osx': ISingleTerminalConfiguration<string | string[]>;
	'terminal.integrated.shell.linux': ISingleTerminalConfiguration<string | string[]>;
	'terminal.integrated.shellArgs.windows': ISingleTerminalConfiguration<string | string[]>;
	'terminal.integrated.shellArgs.osx': ISingleTerminalConfiguration<string | string[]>;
	'terminal.integrated.shellArgs.linux': ISingleTerminalConfiguration<string | string[]>;
	'terminal.integrated.env.windows': ISingleTerminalConfiguration<ITerminalEnvironment>;
	'terminal.integrated.env.osx': ISingleTerminalConfiguration<ITerminalEnvironment>;
	'terminal.integrated.env.linux': ISingleTerminalConfiguration<ITerminalEnvironment>;
	'terminal.integrated.cwd': string;
	'terminal.integrated.detectLocale': 'auto' | 'off' | 'on';
}

export type ITerminalEnvironmentVariableCollections = [string, ISerializableEnvironmentVariableCollection][];

export interface IWorkspaceFolderData {
	uri: UriComponents;
	name: string;
	index: number;
}

export interface ISetTerminalLayoutInfoArgs {
	workspaceId: string;
	tabs: ITerminalTabLayoutInfoById[];
}

export interface IGetTerminalLayoutInfoArgs {
	workspaceId: string;
}

export interface IProcessDetails {
	id: number;
	pid: number;
	title: string;
	titleSource: TitleEventSource;
	cwd: string;
	workspaceId: string;
	workspaceName: string;
	isOrphan: boolean;
	icon: TerminalIcon | undefined;
	color: string | undefined;
}

export type ITerminalTabLayoutInfoDto = IRawTerminalTabLayoutInfo<IProcessDetails>;

export interface ReplayEntry { cols: number; rows: number; data: string; }
export interface IPtyHostProcessReplayEvent {
	events: ReplayEntry[];
}
