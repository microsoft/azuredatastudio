/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as arrays from '../util/arrays';
import { Disposable } from '../util/dispose';

const resolveExtensionResource = (extension: vscode.Extension<any>, resourcePath: string): vscode.Uri => {
	return vscode.Uri.file(path.join(extension.extensionPath, resourcePath));
};

const resolveBookResources = (extension: vscode.Extension<any>, books: BookContribution | BookContribution[]): BookContribution[] => {
	if (!books) {
		return [];
	}
	if (!Array.isArray(books)) {
		books = [books];
	}
	let result = books.map(book => {
		try {
			book.path = resolveExtensionResource(extension, book.path).fsPath;
		} catch (e) {
			// noop
		}
		return book;
	});
	return result;
};

interface BookContribution {
	name: string;
	path: string;
	when?: string;
}

namespace BookContributions {

	export function merge(a: BookContribution[], b: BookContribution[]): BookContribution[] {
		if (!a) {
			return b;
		} else if (!b) {
			return a;
		}
		return a.concat(b);
	}

	export function equal(a: BookContribution, b: BookContribution): boolean {
		return (a.name === b.name)
			&& (a.path === b.path)
			&& (a.when === b.when);
	}

	export function fromExtension(
		extension: vscode.Extension<any>
	): BookContribution[] {
		const contributions = extension.packageJSON?.contributes as unknown[];
		if (!contributions) {
			return [];
		}

		return getContributedBooks(contributions, extension);
	}


	function getContributedBooks(
		contributes: any,
		extension: vscode.Extension<any>
	): BookContribution[] {
		if (contributes['notebook.books']) {
			return resolveBookResources(extension, contributes['notebook.books']);
		}
		return [];
	}
}

export interface BookContributionProvider {
	readonly extensionPath: string;
	readonly contributions: BookContribution[];
	readonly onContributionsChanged: vscode.Event<this>;

	dispose(): void;
}

class AzdataExtensionBookContributionProvider extends Disposable implements BookContributionProvider {
	private _contributions?: BookContribution[];
	private _contributionCommands: vscode.Disposable[] = [];

	public constructor(
		public readonly extensionPath: string,
	) {
		super();

		vscode.extensions.onDidChange(async () => {
			const currentContributions = this.getCurrentContributions();
			const existingContributions = this._contributions || undefined;
			if (!existingContributions || !arrays.equals(existingContributions, currentContributions, BookContributions.equal)) {
				await this.unregisterCommands();
				this._contributions = currentContributions;
				await this.registerCommands();
				this._onContributionsChanged.fire(this);
			}
		}, undefined, this._disposables);

		this.registerCommands().catch(err => console.log(`Error registering contributed book commands : ${err}`));
	}

	private readonly _onContributionsChanged = this._register(new vscode.EventEmitter<this>());
	public readonly onContributionsChanged = this._onContributionsChanged.event;

	public get contributions(): BookContribution[] {
		if (!this._contributions) {
			this._contributions = this.getCurrentContributions();
		}
		return this._contributions;
	}

	private getCurrentContributions(): BookContribution[] {
		return vscode.extensions.all
			.map(BookContributions.fromExtension)
			.reduce(BookContributions.merge, []);
	}

	private async registerCommands(): Promise<void> {
		await Promise.all(this.contributions.map(async book => {
			let bookName: string = path.basename(book.path);
			await vscode.commands.executeCommand('setContext', bookName, true);
			this._contributionCommands.push(vscode.commands.registerCommand('books.' + bookName, async (urlToOpen?: string) => {
				await vscode.commands.executeCommand('bookTreeView.openBook', book.path, true, urlToOpen);
			}));
		}));
	}

	private async unregisterCommands(): Promise<void> {
		this._contributionCommands.forEach(command => command.dispose());
		this._contributionCommands = [];
		await Promise.all(this.contributions.map(async book => {
			let bookName: string = path.basename(book.path);
			await vscode.commands.executeCommand('setContext', bookName, false);
		}));
	}
}

export function getBookExtensionContributions(context: vscode.ExtensionContext): BookContributionProvider {
	return new AzdataExtensionBookContributionProvider(context.extensionPath);
}
