/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { MarkdownEngine } from '../markdownEngine';
import { TableOfContents, TocEntry } from '../tableOfContents';
import { SkinnyTextDocument } from '../workspaceContents';

interface MarkdownSymbol {
	readonly level: number;
	readonly parent: MarkdownSymbol | undefined;
	readonly children: vscode.DocumentSymbol[];
}

export class MdDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

	constructor(
		private readonly engine: MarkdownEngine
	) { }

	public async provideDocumentSymbolInformation(document: SkinnyTextDocument): Promise<vscode.SymbolInformation[]> {
		const toc = await TableOfContents.create(this.engine, document);
		return toc.entries.map(entry => this.toSymbolInformation(entry));
	}

	public async provideDocumentSymbols(document: SkinnyTextDocument): Promise<vscode.DocumentSymbol[]> {
		const toc = await TableOfContents.create(this.engine, document);
		const root: MarkdownSymbol = {
			level: -Infinity,
			children: [],
			parent: undefined
		};
		this.buildTree(root, toc.entries);
		return root.children;
	}

	private buildTree(parent: MarkdownSymbol, entries: readonly TocEntry[]) {
		if (!entries.length) {
			return;
		}

		const entry = entries[0];
		const symbol = this.toDocumentSymbol(entry);
		symbol.children = [];

		while (parent && entry.level <= parent.level) {
			parent = parent.parent!;
		}
		parent.children.push(symbol);
		this.buildTree({ level: entry.level, children: symbol.children, parent }, entries.slice(1));
	}


	private toSymbolInformation(entry: TocEntry): vscode.SymbolInformation {
		return new vscode.SymbolInformation(
			this.getSymbolName(entry),
			vscode.SymbolKind.String,
			'',
			entry.sectionLocation);
	}

	private toDocumentSymbol(entry: TocEntry) {
		return new vscode.DocumentSymbol(
			this.getSymbolName(entry),
			'',
			vscode.SymbolKind.String,
			entry.sectionLocation.range,
			entry.sectionLocation.range);
	}

	private getSymbolName(entry: TocEntry): string {
		return '#'.repeat(entry.level) + ' ' + entry.text;
	}
}
