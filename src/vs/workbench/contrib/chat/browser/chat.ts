/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { ISlashCommand } from 'vs/workbench/contrib/chat/common/chatService';
import { IChatRequestViewModel, IChatResponseViewModel, IChatViewModel, IChatWelcomeMessageViewModel } from 'vs/workbench/contrib/chat/common/chatViewModel';
import { Event } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IChatWidgetService = createDecorator<IChatWidgetService>('chatWidgetService');

export interface IChatWidgetService {

	readonly _serviceBrand: undefined;

	/**
	 * Returns the most recently focused widget if any.
	 */
	readonly lastFocusedWidget: IChatWidget | undefined;

	/**
	 * Returns whether a view was successfully revealed.
	 */
	revealViewForProvider(providerId: string): Promise<IChatWidget | undefined>;

	getWidgetByInputUri(uri: URI): IChatWidget | undefined;
}

export interface IChatCodeBlockInfo {
	codeBlockIndex: number;
	element: IChatResponseViewModel;
	focus(): void;
}

export type ChatTreeItem = IChatRequestViewModel | IChatResponseViewModel | IChatWelcomeMessageViewModel;

export type IChatWidgetViewContext = { viewId: string } | { resource: boolean };

export interface IChatWidget {
	readonly onDidChangeViewModel: Event<void>;
	readonly viewContext: IChatWidgetViewContext;
	readonly viewModel: IChatViewModel | undefined;
	readonly inputEditor: ICodeEditor;
	readonly providerId: string;

	reveal(item: ChatTreeItem): void;
	getFocus(): ChatTreeItem | undefined;
	acceptInput(query?: string): void;
	focusLastMessage(): void;
	focusInput(): void;
	getSlashCommands(): Promise<ISlashCommand[] | undefined>;
	getCodeBlockInfoForEditor(uri: URI): IChatCodeBlockInfo | undefined;
	getCodeBlockInfosForResponse(response: IChatResponseViewModel): IChatCodeBlockInfo[];
}

export interface IChatViewPane {
	clear(): void;
}
