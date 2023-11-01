/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { illegalArgument, onUnexpectedExternalError } from 'vs/base/common/errors';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { assertType } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import { ITextModel } from 'vs/editor/common/model';
import { CodeLens, CodeLensList, CodeLensProvider } from 'vs/editor/common/languages';
import { IModelService } from 'vs/editor/common/services/model';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { LanguageFeatureRegistry } from 'vs/editor/common/languageFeatureRegistry';
import { ILanguageFeaturesService } from 'vs/editor/common/services/languageFeatures';

export interface CodeLensItem {
	symbol: CodeLens;
	provider: CodeLensProvider;
}

export class CodeLensModel {

	lenses: CodeLensItem[] = [];

	private readonly _disposables = new DisposableStore();

	dispose(): void {
		this._disposables.dispose();
	}

	get isDisposed(): boolean {
		return this._disposables.isDisposed;
	}

	add(list: CodeLensList, provider: CodeLensProvider): void {
		this._disposables.add(list);
		for (const symbol of list.lenses) {
			this.lenses.push({ symbol, provider });
		}
	}
}

export async function getCodeLensModel(registry: LanguageFeatureRegistry<CodeLensProvider>, model: ITextModel, token: CancellationToken): Promise<CodeLensModel> {

	const provider = registry.ordered(model);
	const providerRanks = new Map<CodeLensProvider, number>();
	const result = new CodeLensModel();

	const promises = provider.map(async (provider, i) => {

		providerRanks.set(provider, i);

		try {
			const list = await Promise.resolve(provider.provideCodeLenses(model, token));
			if (list) {
				result.add(list, provider);
			}
		} catch (err) {
			onUnexpectedExternalError(err);
		}
	});

	await Promise.all(promises);

	result.lenses = result.lenses.sort((a, b) => {
		// sort by lineNumber, provider-rank, and column
		if (a.symbol.range.startLineNumber < b.symbol.range.startLineNumber) {
			return -1;
		} else if (a.symbol.range.startLineNumber > b.symbol.range.startLineNumber) {
			return 1;
		} else if ((providerRanks.get(a.provider)!) < (providerRanks.get(b.provider)!)) {
			return -1;
		} else if ((providerRanks.get(a.provider)!) > (providerRanks.get(b.provider)!)) {
			return 1;
		} else if (a.symbol.range.startColumn < b.symbol.range.startColumn) {
			return -1;
		} else if (a.symbol.range.startColumn > b.symbol.range.startColumn) {
			return 1;
		} else {
			return 0;
		}
	});
	return result;
}

CommandsRegistry.registerCommand('_executeCodeLensProvider', function (accessor, ...args: [URI, number | undefined | null]) {
	let [uri, itemResolveCount] = args;
	assertType(URI.isUri(uri));
	assertType(typeof itemResolveCount === 'number' || !itemResolveCount);

	const { codeLensProvider } = accessor.get(ILanguageFeaturesService);

	const model = accessor.get(IModelService).getModel(uri);
	if (!model) {
		throw illegalArgument();
	}

	const result: CodeLens[] = [];
	const disposables = new DisposableStore();
	return getCodeLensModel(codeLensProvider, model, CancellationToken.None).then(value => {

		disposables.add(value);
		const resolve: Promise<any>[] = [];

		for (const item of value.lenses) {
			if (itemResolveCount === undefined || itemResolveCount === null || Boolean(item.symbol.command)) {
				result.push(item.symbol);
			} else if (itemResolveCount-- > 0 && item.provider.resolveCodeLens) {
				resolve.push(Promise.resolve(item.provider.resolveCodeLens(model, item.symbol, CancellationToken.None)).then(symbol => result.push(symbol || item.symbol)));
			}
		}

		return Promise.all(resolve);

	}).then(() => {
		return result;
	}).finally(() => {
		// make sure to return results, then (on next tick)
		// dispose the results
		setTimeout(() => disposables.dispose(), 100);
	});
});
