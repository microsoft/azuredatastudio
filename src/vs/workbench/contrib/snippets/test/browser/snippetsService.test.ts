/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { SnippetCompletionProvider } from 'vs/workbench/contrib/snippets/browser/snippetCompletionProvider';
import { Position } from 'vs/editor/common/core/position';
import { ModesRegistry } from 'vs/editor/common/modes/modesRegistry';
import { ModeServiceImpl } from 'vs/editor/common/services/modeServiceImpl';
import { createTextModel } from 'vs/editor/test/common/editorTestUtils';
import { ISnippetsService } from 'vs/workbench/contrib/snippets/browser/snippets.contribution';
import { Snippet, SnippetSource } from 'vs/workbench/contrib/snippets/browser/snippetsFile';
import { LanguageConfigurationRegistry } from 'vs/editor/common/modes/languageConfigurationRegistry';
import { CompletionContext, CompletionItemLabel, CompletionItemRanges, CompletionTriggerKind } from 'vs/editor/common/modes';
import { DisposableStore } from 'vs/base/common/lifecycle';

class SimpleSnippetService implements ISnippetsService {
	declare readonly _serviceBrand: undefined;
	constructor(readonly snippets: Snippet[]) { }
	getSnippets() {
		return Promise.resolve(this.getSnippetsSync());
	}
	getSnippetsSync(): Snippet[] {
		return this.snippets;
	}
	getSnippetFiles(): any {
		throw new Error();
	}
	isEnabled(): boolean {
		throw new Error();
	}
	updateEnablement(): void {
		throw new Error();
	}
}

suite('SnippetsService', function () {
	const disposableStore: DisposableStore = new DisposableStore();
	const context: CompletionContext = { triggerKind: CompletionTriggerKind.Invoke };

	suiteSetup(function () {
		disposableStore.add(ModesRegistry.registerLanguage({
			id: 'fooLang',
			extensions: ['.fooLang',]
		}));
	});

	suiteTeardown(function () {
		disposableStore.dispose();
	});

	let disposables: DisposableStore;
	let modeService: ModeServiceImpl;
	let snippetService: ISnippetsService;

	setup(function () {
		disposables = new DisposableStore();
		modeService = disposables.add(new ModeServiceImpl());
		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'barTest',
			'bar',
			'',
			'barCodeSnippet',
			'',
			SnippetSource.User
		), new Snippet(
			['fooLang'],
			'bazzTest',
			'bazz',
			'',
			'bazzCodeSnippet',
			'',
			SnippetSource.User
		)]);
	});

	teardown(() => {
		disposables.dispose();
	});

	test('snippet completions - simple', function () {

		const provider = new SnippetCompletionProvider(modeService, snippetService);
		const model = disposables.add(createTextModel('', undefined, 'fooLang'));

		return provider.provideCompletionItems(model, new Position(1, 1), context)!.then(result => {
			assert.strictEqual(result.incomplete, undefined);
			assert.strictEqual(result.suggestions.length, 2);
		});
	});

	test('snippet completions - simple 2', function () {

		const provider = new SnippetCompletionProvider(modeService, snippetService);
		const model = disposables.add(createTextModel('hello ', undefined, 'fooLang'));

		return provider.provideCompletionItems(model, new Position(1, 6), context)!.then(result => {
			assert.strictEqual(result.incomplete, undefined);
			assert.strictEqual(result.suggestions.length, 2);
		});
	});

	test('snippet completions - with prefix', function () {

		const provider = new SnippetCompletionProvider(modeService, snippetService);
		const model = disposables.add(createTextModel('bar', undefined, 'fooLang'));

		return provider.provideCompletionItems(model, new Position(1, 4), context)!.then(result => {
			assert.strictEqual(result.incomplete, undefined);
			assert.strictEqual(result.suggestions.length, 1);
			assert.deepStrictEqual(result.suggestions[0].label, {
				label: 'bar',
				description: 'barTest'
			});
			assert.strictEqual((result.suggestions[0].range as any).insert.startColumn, 1);
			assert.strictEqual(result.suggestions[0].insertText, 'barCodeSnippet');
		});
	});

	test('snippet completions - with different prefixes', async function () {

		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'barTest',
			'bar',
			'',
			's1',
			'',
			SnippetSource.User
		), new Snippet(
			['fooLang'],
			'name',
			'bar-bar',
			'',
			's2',
			'',
			SnippetSource.User
		)]);

		const provider = new SnippetCompletionProvider(modeService, snippetService);
		const model = disposables.add(createTextModel('bar-bar', undefined, 'fooLang'));

		await provider.provideCompletionItems(model, new Position(1, 3), context)!.then(result => {
			assert.strictEqual(result.incomplete, undefined);
			assert.strictEqual(result.suggestions.length, 2);
			assert.deepStrictEqual(result.suggestions[0].label, {
				label: 'bar',
				description: 'barTest'
			});
			assert.strictEqual(result.suggestions[0].insertText, 's1');
			assert.strictEqual((result.suggestions[0].range as CompletionItemRanges).insert.startColumn, 1);
			assert.deepStrictEqual(result.suggestions[1].label, {
				label: 'bar-bar',
				description: 'name'
			});
			assert.strictEqual(result.suggestions[1].insertText, 's2');
			assert.strictEqual((result.suggestions[1].range as CompletionItemRanges).insert.startColumn, 1);
		});

		await provider.provideCompletionItems(model, new Position(1, 5), context)!.then(result => {
			assert.strictEqual(result.incomplete, undefined);
			assert.strictEqual(result.suggestions.length, 2);

			const [first, second] = result.suggestions;

			assert.deepStrictEqual(first.label, {
				label: 'bar',
				description: 'barTest'
			});
			assert.strictEqual(first.insertText, 's1');
			assert.strictEqual((first.range as CompletionItemRanges).insert.startColumn, 5);

			assert.deepStrictEqual(second.label, {
				label: 'bar-bar',
				description: 'name'
			});
			assert.strictEqual(second.insertText, 's2');
			assert.strictEqual((second.range as CompletionItemRanges).insert.startColumn, 1);
		});

		await provider.provideCompletionItems(model, new Position(1, 6), context)!.then(result => {
			assert.strictEqual(result.incomplete, undefined);
			assert.strictEqual(result.suggestions.length, 2);
			assert.deepStrictEqual(result.suggestions[0].label, {
				label: 'bar',
				description: 'barTest'
			});
			assert.strictEqual(result.suggestions[0].insertText, 's1');
			assert.strictEqual((result.suggestions[0].range as any).insert.startColumn, 5);
			assert.deepStrictEqual(result.suggestions[1].label, {
				label: 'bar-bar',
				description: 'name'
			});
			assert.strictEqual(result.suggestions[1].insertText, 's2');
			assert.strictEqual((result.suggestions[1].range as any).insert.startColumn, 1);
		});
	});

	test('Cannot use "<?php" as user snippet prefix anymore, #26275', function () {
		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'',
			'<?php',
			'',
			'insert me',
			'',
			SnippetSource.User
		)]);

		const provider = new SnippetCompletionProvider(modeService, snippetService);

		let model = createTextModel('\t<?php', undefined, 'fooLang');
		return provider.provideCompletionItems(model, new Position(1, 7), context)!.then(result => {
			assert.strictEqual(result.suggestions.length, 1);
			model.dispose();

			model = createTextModel('\t<?', undefined, 'fooLang');
			return provider.provideCompletionItems(model, new Position(1, 4), context)!;
		}).then(result => {
			assert.strictEqual(result.suggestions.length, 1);
			assert.strictEqual((result.suggestions[0].range as any).insert.startColumn, 2);
			model.dispose();

			model = createTextModel('a<?', undefined, 'fooLang');
			return provider.provideCompletionItems(model, new Position(1, 4), context)!;
		}).then(result => {
			assert.strictEqual(result.suggestions.length, 1);
			assert.strictEqual((result.suggestions[0].range as any).insert.startColumn, 2);
			model.dispose();
		});
	});

	test('No user snippets in suggestions, when inside the code, #30508', function () {

		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'',
			'foo',
			'',
			'<foo>$0</foo>',
			'',
			SnippetSource.User
		)]);

		const provider = new SnippetCompletionProvider(modeService, snippetService);

		let model = disposables.add(createTextModel('<head>\n\t\n>/head>', undefined, 'fooLang'));
		return provider.provideCompletionItems(model, new Position(1, 1), context)!.then(result => {
			assert.strictEqual(result.suggestions.length, 1);
			return provider.provideCompletionItems(model, new Position(2, 2), context)!;
		}).then(result => {
			assert.strictEqual(result.suggestions.length, 1);
		});
	});

	test('SnippetSuggest - ensure extension snippets come last ', function () {
		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'second',
			'second',
			'',
			'second',
			'',
			SnippetSource.Extension
		), new Snippet(
			['fooLang'],
			'first',
			'first',
			'',
			'first',
			'',
			SnippetSource.User
		)]);

		const provider = new SnippetCompletionProvider(modeService, snippetService);

		let model = disposables.add(createTextModel('', undefined, 'fooLang'));
		return provider.provideCompletionItems(model, new Position(1, 1), context)!.then(result => {
			assert.strictEqual(result.suggestions.length, 2);
			let [first, second] = result.suggestions;
			assert.deepStrictEqual(first.label, {
				label: 'first',
				description: 'first'
			});
			assert.deepStrictEqual(second.label, {
				label: 'second',
				description: 'second'
			});
		});
	});

	test('Dash in snippets prefix broken #53945', async function () {
		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'p-a',
			'p-a',
			'',
			'second',
			'',
			SnippetSource.User
		)]);
		const provider = new SnippetCompletionProvider(modeService, snippetService);

		let model = disposables.add(createTextModel('p-', undefined, 'fooLang'));

		let result = await provider.provideCompletionItems(model, new Position(1, 2), context)!;
		assert.strictEqual(result.suggestions.length, 1);

		result = await provider.provideCompletionItems(model, new Position(1, 3), context)!;
		assert.strictEqual(result.suggestions.length, 1);

		result = await provider.provideCompletionItems(model, new Position(1, 3), context)!;
		assert.strictEqual(result.suggestions.length, 1);
	});

	test('No snippets suggestion on long lines beyond character 100 #58807', async function () {
		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'bug',
			'bug',
			'',
			'second',
			'',
			SnippetSource.User
		)]);

		const provider = new SnippetCompletionProvider(modeService, snippetService);

		let model = disposables.add(createTextModel('Thisisaverylonglinegoingwithmore100bcharactersandthismakesintellisensebecomea Thisisaverylonglinegoingwithmore100bcharactersandthismakesintellisensebecomea b', undefined, 'fooLang'));
		let result = await provider.provideCompletionItems(model, new Position(1, 158), context)!;

		assert.strictEqual(result.suggestions.length, 1);
	});

	test('Type colon will trigger snippet #60746', async function () {
		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'bug',
			'bug',
			'',
			'second',
			'',
			SnippetSource.User
		)]);

		const provider = new SnippetCompletionProvider(modeService, snippetService);

		let model = disposables.add(createTextModel(':', undefined, 'fooLang'));
		let result = await provider.provideCompletionItems(model, new Position(1, 2), context)!;

		assert.strictEqual(result.suggestions.length, 0);
	});

	test('substring of prefix can\'t trigger snippet #60737', async function () {
		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'mytemplate',
			'mytemplate',
			'',
			'second',
			'',
			SnippetSource.User
		)]);

		const provider = new SnippetCompletionProvider(modeService, snippetService);

		let model = disposables.add(createTextModel('template', undefined, 'fooLang'));
		let result = await provider.provideCompletionItems(model, new Position(1, 9), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		assert.deepStrictEqual(result.suggestions[0].label, {
			label: 'mytemplate',
			description: 'mytemplate'
		});
	});

	test('No snippets suggestion beyond character 100 if not at end of line #60247', async function () {
		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'bug',
			'bug',
			'',
			'second',
			'',
			SnippetSource.User
		)]);

		const provider = new SnippetCompletionProvider(modeService, snippetService);

		let model = disposables.add(createTextModel('Thisisaverylonglinegoingwithmore100bcharactersandthismakesintellisensebecomea Thisisaverylonglinegoingwithmore100bcharactersandthismakesintellisensebecomea b text_after_b', undefined, 'fooLang'));
		let result = await provider.provideCompletionItems(model, new Position(1, 158), context)!;

		assert.strictEqual(result.suggestions.length, 1);
	});

	test('issue #61296: VS code freezes when editing CSS file with emoji', async function () {
		disposableStore.add(LanguageConfigurationRegistry.register('fooLang'!, {
			wordPattern: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g
		}));

		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'bug',
			'-a-bug',
			'',
			'second',
			'',
			SnippetSource.User
		)]);

		const provider = new SnippetCompletionProvider(modeService, snippetService);

		let model = disposables.add(createTextModel('.🐷-a-b', undefined, 'fooLang'));
		let result = await provider.provideCompletionItems(model, new Position(1, 8), context)!;

		assert.strictEqual(result.suggestions.length, 1);
	});

	test('No snippets shown when triggering completions at whitespace on line that already has text #62335', async function () {
		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'bug',
			'bug',
			'',
			'second',
			'',
			SnippetSource.User
		)]);

		const provider = new SnippetCompletionProvider(modeService, snippetService);

		let model = disposables.add(createTextModel('a ', undefined, 'fooLang'));
		let result = await provider.provideCompletionItems(model, new Position(1, 3), context)!;

		assert.strictEqual(result.suggestions.length, 1);
	});

	test('Snippet prefix with special chars and numbers does not work #62906', async function () {
		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'noblockwdelay',
			'<<',
			'',
			'<= #dly"',
			'',
			SnippetSource.User
		), new Snippet(
			['fooLang'],
			'noblockwdelay',
			'11',
			'',
			'eleven',
			'',
			SnippetSource.User
		)]);

		const provider = new SnippetCompletionProvider(modeService, snippetService);

		let model = createTextModel(' <', undefined, 'fooLang');
		let result = await provider.provideCompletionItems(model, new Position(1, 3), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		let [first] = result.suggestions;
		assert.strictEqual((first.range as any).insert.startColumn, 2);
		model.dispose();

		model = createTextModel('1', undefined, 'fooLang');
		result = await provider.provideCompletionItems(model, new Position(1, 2), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		[first] = result.suggestions;
		assert.strictEqual((first.range as any).insert.startColumn, 1);
		model.dispose();
	});

	test('Snippet replace range', async function () {
		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'notWordTest',
			'not word',
			'',
			'not word snippet',
			'',
			SnippetSource.User
		)]);

		const provider = new SnippetCompletionProvider(modeService, snippetService);

		let model = createTextModel('not wordFoo bar', undefined, 'fooLang');
		let result = await provider.provideCompletionItems(model, new Position(1, 3), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		let [first] = result.suggestions;
		assert.strictEqual((first.range as any).insert.endColumn, 3);
		assert.strictEqual((first.range as any).replace.endColumn, 9);
		model.dispose();

		model = createTextModel('not woFoo bar', undefined, 'fooLang');
		result = await provider.provideCompletionItems(model, new Position(1, 3), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		[first] = result.suggestions;
		assert.strictEqual((first.range as any).insert.endColumn, 3);
		assert.strictEqual((first.range as any).replace.endColumn, 3);
		model.dispose();

		model = createTextModel('not word', undefined, 'fooLang');
		result = await provider.provideCompletionItems(model, new Position(1, 1), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		[first] = result.suggestions;
		assert.strictEqual((first.range as any).insert.endColumn, 1);
		assert.strictEqual((first.range as any).replace.endColumn, 9);
		model.dispose();
	});

	test('Snippet replace-range incorrect #108894', async function () {

		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'eng',
			'eng',
			'',
			'<span></span>',
			'',
			SnippetSource.User
		)]);

		const provider = new SnippetCompletionProvider(modeService, snippetService);

		let model = createTextModel('filler e KEEP ng filler', undefined, 'fooLang');
		let result = await provider.provideCompletionItems(model, new Position(1, 9), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		let [first] = result.suggestions;
		assert.strictEqual((first.range as any).insert.endColumn, 9);
		assert.strictEqual((first.range as any).replace.endColumn, 9);
		model.dispose();
	});

	test('Snippet will replace auto-closing pair if specified in prefix', async function () {
		disposableStore.add(LanguageConfigurationRegistry.register('fooLang'!, {
			brackets: [
				['{', '}'],
				['[', ']'],
				['(', ')'],
			]
		}));

		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'PSCustomObject',
			'[PSCustomObject]',
			'',
			'[PSCustomObject] @{ Key = Value }',
			'',
			SnippetSource.User
		)]);

		const provider = new SnippetCompletionProvider(modeService, snippetService);

		let model = createTextModel('[psc]', undefined, 'fooLang');
		let result = await provider.provideCompletionItems(model, new Position(1, 5), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		let [first] = result.suggestions;
		assert.strictEqual((first.range as any).insert.endColumn, 5);
		// This is 6 because it should eat the `]` at the end of the text even if cursor is before it
		assert.strictEqual((first.range as any).replace.endColumn, 6);
		model.dispose();
	});

	test('Leading whitespace in snippet prefix #123860', async function () {

		snippetService = new SimpleSnippetService([new Snippet(
			['fooLang'],
			'cite-name',
			' cite',
			'',
			'~\\cite{$CLIPBOARD}',
			'',
			SnippetSource.User
		)]);

		const provider = new SnippetCompletionProvider(modeService, snippetService);

		let model = createTextModel(' ci', undefined, 'fooLang');
		let result = await provider.provideCompletionItems(model, new Position(1, 4), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		let [first] = result.suggestions;
		assert.strictEqual((<CompletionItemLabel>first.label).label, ' cite');
		assert.strictEqual((<CompletionItemRanges>first.range).insert.startColumn, 1);

		model.dispose();
	});
});
