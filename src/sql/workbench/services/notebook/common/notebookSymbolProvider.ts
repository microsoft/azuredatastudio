/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DocumentSymbolProvider, ProviderResult, DocumentSymbol, SymbolKind } from 'vs/editor/common/modes';
import { ITextModel } from 'vs/editor/common/model';
import { CancellationToken } from 'vs/base/common/cancellation';
import { localize } from 'vs/nls';
import { Range } from 'vs/editor/common/core/range';

import { INotebookService, INotebookSection } from 'sql/workbench/services/notebook/common/notebookService';

interface NotebookSymbol {
	readonly level: number;
	readonly parent: NotebookSymbol | undefined;
	readonly children: DocumentSymbol[];
}

export class NotebookSymbolProvider implements DocumentSymbolProvider {
	readonly displayName?: string = localize('notebookSymbolProvider', 'Notebook Symbols');

	constructor(private notebookService: INotebookService) {
	}

	provideDocumentSymbols(model: ITextModel, token: CancellationToken): ProviderResult<DocumentSymbol[]> {
		let notebook = this.notebookService.findNotebookEditor(model.uri);
		if (notebook) {
			let sections = notebook.getSections();
			const root: NotebookSymbol = {
				level: -Infinity,
				children: [],
				parent: undefined
			};
			this.buildTree(root, sections);
			return root.children;
		}
		return [];
	}

	private buildTree(parent: NotebookSymbol, entries: INotebookSection[]) {
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


	private toDocumentSymbol(entry: INotebookSection): DocumentSymbol {
		let symbol: DocumentSymbol = {
			name: this.getSymbolName(entry),
			detail: '',
			kind: SymbolKind.String,
			range: new Range(0, 0, 0, 0),
			selectionRange: new Range(0, 0, 0, 0)
		};
		return symbol;
	}

	private getSymbolName(entry: INotebookSection): string {
		return '#'.repeat(entry.level) + ' ' + entry.header;
	}
}