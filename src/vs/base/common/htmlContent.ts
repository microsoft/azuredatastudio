/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { UriComponents } from 'vs/base/common/uri';
import { escapeIcons } from 'vs/base/common/iconLabels';
import { illegalArgument } from 'vs/base/common/errors';

export interface IMarkdownString {
	readonly value: string;
	readonly isTrusted?: boolean;
	readonly supportThemeIcons?: boolean;
	uris?: { [href: string]: UriComponents };
}

export const enum MarkdownStringTextNewlineStyle {
	Paragraph = 0,
	Break = 1,
}

export class MarkdownString implements IMarkdownString {

	public value: string;
	public isTrusted?: boolean;
	public supportThemeIcons?: boolean;

	constructor(
		value: string = '',
		isTrustedOrOptions: boolean | { isTrusted?: boolean, supportThemeIcons?: boolean } = false,
	) {
		this.value = value;
		if (typeof this.value !== 'string') {
			throw illegalArgument('value');
		}

		if (typeof isTrustedOrOptions === 'boolean') {
			this.isTrusted = isTrustedOrOptions;
			this.supportThemeIcons = false;
		}
		else {
			this.isTrusted = isTrustedOrOptions.isTrusted ?? undefined;
			this.supportThemeIcons = isTrustedOrOptions.supportThemeIcons ?? false;
		}
	}

	appendText(value: string, newlineStyle: MarkdownStringTextNewlineStyle = MarkdownStringTextNewlineStyle.Paragraph): MarkdownString {
		this.value += escapeMarkdownSyntaxTokens(this.supportThemeIcons ? escapeIcons(value) : value)
			.replace(/([ \t]+)/g, (_match, g1) => '&nbsp;'.repeat(g1.length))
			.replace(/^>/gm, '\\>')
			.replace(/\n/g, newlineStyle === MarkdownStringTextNewlineStyle.Break ? '\\\n' : '\n\n');

		return this;
	}

	appendMarkdown(value: string): MarkdownString {
		this.value += value;
		return this;
	}

	appendCodeblock(langId: string, code: string): MarkdownString {
		this.value += '\n```';
		this.value += langId;
		this.value += '\n';
		this.value += code;
		this.value += '\n```\n';
		return this;
	}
}

export function isEmptyMarkdownString(oneOrMany: IMarkdownString | IMarkdownString[] | null | undefined): boolean {
	if (isMarkdownString(oneOrMany)) {
		return !oneOrMany.value;
	} else if (Array.isArray(oneOrMany)) {
		return oneOrMany.every(isEmptyMarkdownString);
	} else {
		return true;
	}
}

export function isMarkdownString(thing: any): thing is IMarkdownString {
	if (thing instanceof MarkdownString) {
		return true;
	} else if (thing && typeof thing === 'object') {
		return typeof (<IMarkdownString>thing).value === 'string'
			&& (typeof (<IMarkdownString>thing).isTrusted === 'boolean' || (<IMarkdownString>thing).isTrusted === undefined)
			&& (typeof (<IMarkdownString>thing).supportThemeIcons === 'boolean' || (<IMarkdownString>thing).supportThemeIcons === undefined);
	}
	return false;
}

export function markdownStringEqual(a: IMarkdownString, b: IMarkdownString): boolean {
	if (a === b) {
		return true;
	} else if (!a || !b) {
		return false;
	} else {
		return a.value === b.value && a.isTrusted === b.isTrusted && a.supportThemeIcons === b.supportThemeIcons;
	}
}

export function escapeMarkdownSyntaxTokens(text: string): string {
	// escape markdown syntax tokens: http://daringfireball.net/projects/markdown/syntax#backslash
	return text.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
}

export function removeMarkdownEscapes(text: string): string {
	if (!text) {
		return text;
	}
	return text.replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1');
}

export function parseHrefAndDimensions(href: string): { href: string, dimensions: string[] } {
	const dimensions: string[] = [];
	const splitted = href.split('|').map(s => s.trim());
	href = splitted[0];
	const parameters = splitted[1];
	if (parameters) {
		const heightFromParams = /height=(\d+)/.exec(parameters);
		const widthFromParams = /width=(\d+)/.exec(parameters);
		const height = heightFromParams ? heightFromParams[1] : '';
		const width = widthFromParams ? widthFromParams[1] : '';
		const widthIsFinite = isFinite(parseInt(width));
		const heightIsFinite = isFinite(parseInt(height));
		if (widthIsFinite) {
			dimensions.push(`width="${width}"`);
		}
		if (heightIsFinite) {
			dimensions.push(`height="${height}"`);
		}
	}
	return { href, dimensions };
}
