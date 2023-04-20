/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IDisposable } from 'vs/base/common/lifecycle';
import { ThemeColor } from 'vs/platform/theme/common/themeService';
import { Event } from 'vs/base/common/event';
import { Command } from 'vs/editor/common/languages';
import { IMarkdownString } from 'vs/base/common/htmlContent';
import { ColorIdentifier } from 'vs/platform/theme/common/colorRegistry';

export const IStatusbarService = createDecorator<IStatusbarService>('statusbarService');

export interface IStatusbarService {

	readonly _serviceBrand: undefined;

	/**
	 * An event that is triggered when an entry's visibility is changed.
	 */
	readonly onDidChangeEntryVisibility: Event<{ id: string; visible: boolean }>;

	/**
	 * Adds an entry to the statusbar with the given alignment and priority. Use the returned accessor
	 * to update or remove the statusbar entry.
	 *
	 * @param id identifier of the entry is needed to allow users to hide entries via settings
	 * @param alignment either LEFT or RIGHT side in the status bar
	 * @param priority items get arranged from highest priority to lowest priority from left to right
	 * in their respective alignment slot
	 */
	addEntry(entry: IStatusbarEntry, id: string, alignment: StatusbarAlignment, priority?: number): IStatusbarEntryAccessor;

	/**
	 * Adds an entry to the statusbar with the given alignment relative to another entry. Use the returned
	 * accessor to update or remove the statusbar entry.
	 *
	 * @param id identifier of the entry is needed to allow users to hide entries via settings
	 * @param alignment either LEFT or RIGHT side in the status bar
	 * @param location a reference to another entry to position relative to
	 */
	addEntry(entry: IStatusbarEntry, id: string, alignment: StatusbarAlignment, location?: IStatusbarEntryLocation): IStatusbarEntryAccessor;

	/**
	 * Return if an entry is visible or not.
	 */
	isEntryVisible(id: string): boolean;

	/**
	 * Allows to update an entry's visibility with the provided ID.
	 */
	updateEntryVisibility(id: string, visible: boolean): void;

	/**
	 * Focused the status bar. If one of the status bar entries was focused, focuses it directly.
	 */
	focus(preserveEntryFocus?: boolean): void;

	/**
	 * Focuses the next status bar entry. If none focused, focuses the first.
	 */
	focusNextEntry(): void;

	/**
	 * Focuses the previous status bar entry. If none focused, focuses the last.
	 */
	focusPreviousEntry(): void;

	/**
	 *	Returns true if a status bar entry is focused.
	 */
	isEntryFocused(): boolean;

	/**
	 * Temporarily override statusbar style.
	 */
	overrideStyle(style: IStatusbarStyleOverride): IDisposable;
}

export const enum StatusbarAlignment {
	LEFT,
	RIGHT
}

export interface IStatusbarEntryLocation {

	/**
	 * The identifier of another status bar entry to
	 * position relative to.
	 */
	id: string;

	/**
	 * The alignment of the status bar entry relative
	 * to the referenced entry.
	 */
	alignment: StatusbarAlignment;

	/**
	 * Whether to move the entry close to the location
	 * so that it appears as if both this entry and
	 * the location belong to each other.
	 */
	compact?: boolean;
}

export function isStatusbarEntryLocation(thing: unknown): thing is IStatusbarEntryLocation {
	const candidate = thing as IStatusbarEntryLocation | undefined;

	return typeof candidate?.id === 'string' && typeof candidate.alignment === 'number';
}

export const ShowTooltipCommand: Command = {
	id: 'statusBar.entry.showTooltip',
	title: ''
};

export interface IStatusbarStyleOverride {
	readonly priority: number; // lower has higher priority
	readonly foreground?: ColorIdentifier;
	readonly background?: ColorIdentifier;
	readonly border?: ColorIdentifier;
}

/**
 * A declarative way of describing a status bar entry
 */
export interface IStatusbarEntry {

	/**
	 * The (short) name to show for the entry like 'Language Indicator',
	 * 'Git Status' etc.
	 */
	readonly name: string;

	/**
	 * The text to show for the entry. You can embed icons in the text by leveraging the syntax:
	 *
	 * `My text $(icon name) contains icons like $(icon name) this one.`
	 */
	readonly text: string;

	/**
	 * Text to be read out by the screen reader.
	 */
	readonly ariaLabel: string;

	/**
	 * Role of the status bar entry which defines how a screen reader interacts with it.
	 * Default is 'button'.
	 */
	readonly role?: string;

	/**
	 * An optional tooltip text to show when you hover over the entry
	 */
	readonly tooltip?: string | IMarkdownString | HTMLElement;

	/**
	 * An optional color to use for the entry
	 */
	readonly color?: string | ThemeColor;

	/**
	 * An optional background color to use for the entry
	 */
	readonly backgroundColor?: string | ThemeColor;

	/**
	 * An optional command to execute on click.
	 *
	 * Can use the special `ShowTooltipCommand` to
	 * show the tooltip on click if provided.
	 */
	readonly command?: string | Command | typeof ShowTooltipCommand;

	/**
	 * Whether to show a beak above the status bar entry.
	 */
	readonly showBeak?: boolean;

	/**
	 * Will enable a spinning icon in front of the text to indicate progress. When `true` is
	 * specified, `syncing` will be used.
	 */
	readonly showProgress?: boolean | 'syncing' | 'loading';
}

export interface IStatusbarEntryAccessor extends IDisposable {

	/**
	 * Allows to update an existing status bar entry.
	 */
	update(properties: IStatusbarEntry): void;
}
