/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { SnippetCompletion, SnippetCompletionProvider } from 'vs/workbench/contrib/snippets/browser/snippetCompletionProvider';
import { Position } from 'vs/editor/common/core/position';
import { createModelServices, instantiateTextModel } from 'vs/editor/test/common/testTextModel';
import { ISnippetsService } from 'vs/workbench/contrib/snippets/browser/snippets';
import { Snippet, SnippetSource } from 'vs/workbench/contrib/snippets/browser/snippetsFile';
import { CompletionContext, CompletionItemLabel, CompletionItemRanges, CompletionTriggerKind } from 'vs/editor/common/languages';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { TestLanguageConfigurationService } from 'vs/editor/test/common/modes/testLanguageConfigurationService';
import { EditOperation } from 'vs/editor/common/core/editOperation';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { generateUuid } from 'vs/base/common/uuid';

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
	updateUsageTimestamp(snippet: Snippet): void {
		throw new Error();
	}
}

suite('SnippetsService', function () {
	const context: CompletionContext = { triggerKind: CompletionTriggerKind.Invoke };

	let disposables: DisposableStore;
	let instantiationService: TestInstantiationService;
	let languageService: ILanguageService;
	let snippetService: ISnippetsService;

	setup(function () {
		disposables = new DisposableStore();
		instantiationService = createModelServices(disposables);
		languageService = instantiationService.get(ILanguageService);
		disposables.add(languageService.registerLanguage({
			id: 'fooLang',
			extensions: ['.fooLang',]
		}));
		snippetService = new SimpleSnippetService([new Snippet(
			false,
			['fooLang'],
			'barTest',
			'bar',
			'',
			'barCodeSnippet',
			'',
			SnippetSource.User,
			generateUuid()
		), new Snippet(
			false,
			['fooLang'],
			'bazzTest',
			'bazz',
			'',
			'bazzCodeSnippet',
			'',
			SnippetSource.User,
			generateUuid()
		)]);
	});

	teardown(() => {
		disposables.dispose();
	});

	test('snippet completions - simple', function () {

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());
		const model = disposables.add(instantiateTextModel(instantiationService, '', 'fooLang'));

		return provider.provideCompletionItems(model, new Position(1, 1), context)!.then(result => {
			assert.strictEqual(result.incomplete, undefined);
			assert.strictEqual(result.suggestions.length, 2);
		});
	});

	test('snippet completions - simple 2', async function () {

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());
		const model = disposables.add(instantiateTextModel(instantiationService, 'hello ', 'fooLang'));

		await provider.provideCompletionItems(model, new Position(1, 6) /* hello| */, context)!.then(result => {
			assert.strictEqual(result.incomplete, undefined);
			assert.strictEqual(result.suggestions.length, 0);
		});

		await provider.provideCompletionItems(model, new Position(1, 7) /* hello |*/, context)!.then(result => {
			assert.strictEqual(result.incomplete, undefined);
			assert.strictEqual(result.suggestions.length, 2);
		});
	});

	test('snippet completions - with prefix', function () {

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());
		const model = disposables.add(instantiateTextModel(instantiationService, 'bar', 'fooLang'));

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
			false,
			['fooLang'],
			'barTest',
			'bar',
			'',
			's1',
			'',
			SnippetSource.User,
			generateUuid()
		), new Snippet(
			false,
			['fooLang'],
			'name',
			'bar-bar',
			'',
			's2',
			'',
			SnippetSource.User,
			generateUuid()
		)]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());
		const model = disposables.add(instantiateTextModel(instantiationService, 'bar-bar', 'fooLang'));

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
			false,
			['fooLang'],
			'',
			'<?php',
			'',
			'insert me',
			'',
			SnippetSource.User,
			generateUuid()
		)]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());

		let model = instantiateTextModel(instantiationService, '\t<?php', 'fooLang');
		return provider.provideCompletionItems(model, new Position(1, 7), context)!.then(result => {
			assert.strictEqual(result.suggestions.length, 1);
			model.dispose();

			model = instantiateTextModel(instantiationService, '\t<?', 'fooLang');
			return provider.provideCompletionItems(model, new Position(1, 4), context)!;
		}).then(result => {
			assert.strictEqual(result.suggestions.length, 1);
			assert.strictEqual((result.suggestions[0].range as any).insert.startColumn, 2);
			model.dispose();

			model = instantiateTextModel(instantiationService, 'a<?', 'fooLang');
			return provider.provideCompletionItems(model, new Position(1, 4), context)!;
		}).then(result => {
			assert.strictEqual(result.suggestions.length, 1);
			assert.strictEqual((result.suggestions[0].range as any).insert.startColumn, 2);
			model.dispose();
		});
	});

	test('No user snippets in suggestions, when inside the code, #30508', function () {

		snippetService = new SimpleSnippetService([new Snippet(
			false,
			['fooLang'],
			'',
			'foo',
			'',
			'<foo>$0</foo>',
			'',
			SnippetSource.User,
			generateUuid()
		)]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());

		const model = disposables.add(instantiateTextModel(instantiationService, '<head>\n\t\n>/head>', 'fooLang'));
		return provider.provideCompletionItems(model, new Position(1, 1), context)!.then(result => {
			assert.strictEqual(result.suggestions.length, 1);
			return provider.provideCompletionItems(model, new Position(2, 2), context)!;
		}).then(result => {
			assert.strictEqual(result.suggestions.length, 1);
		});
	});

	test('SnippetSuggest - ensure extension snippets come last ', function () {
		snippetService = new SimpleSnippetService([new Snippet(
			false,
			['fooLang'],
			'second',
			'second',
			'',
			'second',
			'',
			SnippetSource.Extension,
			generateUuid()
		), new Snippet(
			false,
			['fooLang'],
			'first',
			'first',
			'',
			'first',
			'',
			SnippetSource.User,
			generateUuid()
		)]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());

		const model = disposables.add(instantiateTextModel(instantiationService, '', 'fooLang'));
		return provider.provideCompletionItems(model, new Position(1, 1), context)!.then(result => {
			assert.strictEqual(result.suggestions.length, 2);
			const [first, second] = result.suggestions;
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
			false,
			['fooLang'],
			'p-a',
			'p-a',
			'',
			'second',
			'',
			SnippetSource.User,
			generateUuid()
		)]);
		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());

		const model = disposables.add(instantiateTextModel(instantiationService, 'p-', 'fooLang'));

		let result = await provider.provideCompletionItems(model, new Position(1, 2), context)!;
		assert.strictEqual(result.suggestions.length, 1);

		result = await provider.provideCompletionItems(model, new Position(1, 3), context)!;
		assert.strictEqual(result.suggestions.length, 1);

		result = await provider.provideCompletionItems(model, new Position(1, 3), context)!;
		assert.strictEqual(result.suggestions.length, 1);
	});

	test('No snippets suggestion on long lines beyond character 100 #58807', async function () {
		snippetService = new SimpleSnippetService([new Snippet(
			false,
			['fooLang'],
			'bug',
			'bug',
			'',
			'second',
			'',
			SnippetSource.User,
			generateUuid()
		)]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());

		const model = disposables.add(instantiateTextModel(instantiationService, 'Thisisaverylonglinegoingwithmore100bcharactersandthismakesintellisensebecomea Thisisaverylonglinegoingwithmore100bcharactersandthismakesintellisensebecomea b', 'fooLang'));
		const result = await provider.provideCompletionItems(model, new Position(1, 158), context)!;

		assert.strictEqual(result.suggestions.length, 1);
	});

	test('Type colon will trigger snippet #60746', async function () {
		snippetService = new SimpleSnippetService([new Snippet(
			false,
			['fooLang'],
			'bug',
			'bug',
			'',
			'second',
			'',
			SnippetSource.User,
			generateUuid()
		)]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());

		const model = disposables.add(instantiateTextModel(instantiationService, ':', 'fooLang'));
		const result = await provider.provideCompletionItems(model, new Position(1, 2), context)!;

		assert.strictEqual(result.suggestions.length, 0);
	});

	test('substring of prefix can\'t trigger snippet #60737', async function () {
		snippetService = new SimpleSnippetService([new Snippet(
			false,
			['fooLang'],
			'mytemplate',
			'mytemplate',
			'',
			'second',
			'',
			SnippetSource.User,
			generateUuid()
		)]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());

		const model = disposables.add(instantiateTextModel(instantiationService, 'template', 'fooLang'));
		const result = await provider.provideCompletionItems(model, new Position(1, 9), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		assert.deepStrictEqual(result.suggestions[0].label, {
			label: 'mytemplate',
			description: 'mytemplate'
		});
	});

	test('No snippets suggestion beyond character 100 if not at end of line #60247', async function () {
		snippetService = new SimpleSnippetService([new Snippet(
			false,
			['fooLang'],
			'bug',
			'bug',
			'',
			'second',
			'',
			SnippetSource.User,
			generateUuid()
		)]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());

		const model = disposables.add(instantiateTextModel(instantiationService, 'Thisisaverylonglinegoingwithmore100bcharactersandthismakesintellisensebecomea Thisisaverylonglinegoingwithmore100bcharactersandthismakesintellisensebecomea b text_after_b', 'fooLang'));
		const result = await provider.provideCompletionItems(model, new Position(1, 158), context)!;

		assert.strictEqual(result.suggestions.length, 1);
	});

	test('issue #61296: VS code freezes when editing CSS file with emoji', async function () {
		const languageConfigurationService = new TestLanguageConfigurationService();
		disposables.add(languageConfigurationService.register('fooLang', {
			wordPattern: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g
		}));

		snippetService = new SimpleSnippetService([new Snippet(
			false,
			['fooLang'],
			'bug',
			'-a-bug',
			'',
			'second',
			'',
			SnippetSource.User,
			generateUuid()
		)]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, languageConfigurationService);

		const model = disposables.add(instantiateTextModel(instantiationService, '.🐷-a-b', 'fooLang'));
		const result = await provider.provideCompletionItems(model, new Position(1, 8), context)!;

		assert.strictEqual(result.suggestions.length, 1);
	});

	test('No snippets shown when triggering completions at whitespace on line that already has text #62335', async function () {
		snippetService = new SimpleSnippetService([new Snippet(
			false,
			['fooLang'],
			'bug',
			'bug',
			'',
			'second',
			'',
			SnippetSource.User,
			generateUuid()
		)]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());

		const model = disposables.add(instantiateTextModel(instantiationService, 'a ', 'fooLang'));
		const result = await provider.provideCompletionItems(model, new Position(1, 3), context)!;

		assert.strictEqual(result.suggestions.length, 1);
	});

	test('Snippet prefix with special chars and numbers does not work #62906', async function () {
		snippetService = new SimpleSnippetService([new Snippet(
			false,
			['fooLang'],
			'noblockwdelay',
			'<<',
			'',
			'<= #dly"',
			'',
			SnippetSource.User,
			generateUuid()
		), new Snippet(
			false,
			['fooLang'],
			'noblockwdelay',
			'11',
			'',
			'eleven',
			'',
			SnippetSource.User,
			generateUuid()
		)]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());

		let model = instantiateTextModel(instantiationService, ' <', 'fooLang');
		let result = await provider.provideCompletionItems(model, new Position(1, 3), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		let [first] = result.suggestions;
		assert.strictEqual((first.range as any).insert.startColumn, 2);
		model.dispose();

		model = instantiateTextModel(instantiationService, '1', 'fooLang');
		result = await provider.provideCompletionItems(model, new Position(1, 2), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		[first] = result.suggestions;
		assert.strictEqual((first.range as any).insert.startColumn, 1);
		model.dispose();
	});

	test('Snippet replace range', async function () {
		snippetService = new SimpleSnippetService([new Snippet(
			false,
			['fooLang'],
			'notWordTest',
			'not word',
			'',
			'not word snippet',
			'',
			SnippetSource.User,
			generateUuid()
		)]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());

		let model = instantiateTextModel(instantiationService, 'not wordFoo bar', 'fooLang');
		let result = await provider.provideCompletionItems(model, new Position(1, 3), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		let [first] = result.suggestions;
		assert.strictEqual((first.range as any).insert.endColumn, 3);
		assert.strictEqual((first.range as any).replace.endColumn, 9);
		model.dispose();

		model = instantiateTextModel(instantiationService, 'not woFoo bar', 'fooLang');
		result = await provider.provideCompletionItems(model, new Position(1, 3), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		[first] = result.suggestions;
		assert.strictEqual((first.range as any).insert.endColumn, 3);
		assert.strictEqual((first.range as any).replace.endColumn, 3);
		model.dispose();

		model = instantiateTextModel(instantiationService, 'not word', 'fooLang');
		result = await provider.provideCompletionItems(model, new Position(1, 1), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		[first] = result.suggestions;
		assert.strictEqual((first.range as any).insert.endColumn, 1);
		assert.strictEqual((first.range as any).replace.endColumn, 9);
		model.dispose();
	});

	test('Snippet replace-range incorrect #108894', async function () {

		snippetService = new SimpleSnippetService([new Snippet(
			false,
			['fooLang'],
			'eng',
			'eng',
			'',
			'<span></span>',
			'',
			SnippetSource.User,
			generateUuid()
		)]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());

		const model = instantiateTextModel(instantiationService, 'filler e KEEP ng filler', 'fooLang');
		const result = await provider.provideCompletionItems(model, new Position(1, 9), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		const [first] = result.suggestions;
		assert.strictEqual((first.range as any).insert.endColumn, 9);
		assert.strictEqual((first.range as any).replace.endColumn, 9);
		model.dispose();
	});

	test('Snippet will replace auto-closing pair if specified in prefix', async function () {
		const languageConfigurationService = new TestLanguageConfigurationService();
		disposables.add(languageConfigurationService.register('fooLang', {
			brackets: [
				['{', '}'],
				['[', ']'],
				['(', ')'],
			]
		}));

		snippetService = new SimpleSnippetService([new Snippet(
			false,
			['fooLang'],
			'PSCustomObject',
			'[PSCustomObject]',
			'',
			'[PSCustomObject] @{ Key = Value }',
			'',
			SnippetSource.User,
			generateUuid()
		)]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, languageConfigurationService);

		const model = instantiateTextModel(instantiationService, '[psc]', 'fooLang');
		const result = await provider.provideCompletionItems(model, new Position(1, 5), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		const [first] = result.suggestions;
		assert.strictEqual((first.range as any).insert.endColumn, 5);
		// This is 6 because it should eat the `]` at the end of the text even if cursor is before it
		assert.strictEqual((first.range as any).replace.endColumn, 6);
		model.dispose();
	});

	test('Leading whitespace in snippet prefix #123860', async function () {

		snippetService = new SimpleSnippetService([new Snippet(
			false,
			['fooLang'],
			'cite-name',
			' cite',
			'',
			'~\\cite{$CLIPBOARD}',
			'',
			SnippetSource.User,
			generateUuid()
		)]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());

		const model = instantiateTextModel(instantiationService, ' ci', 'fooLang');
		const result = await provider.provideCompletionItems(model, new Position(1, 4), context)!;

		assert.strictEqual(result.suggestions.length, 1);
		const [first] = result.suggestions;
		assert.strictEqual((<CompletionItemLabel>first.label).label, ' cite');
		assert.strictEqual((<CompletionItemRanges>first.range).insert.startColumn, 1);

		model.dispose();
	});

	test('still show suggestions in string when disable string suggestion #136611', async function () {

		snippetService = new SimpleSnippetService([
			new Snippet(false, ['fooLang'], 'aaa', 'aaa', '', 'value', '', SnippetSource.User, generateUuid()),
			new Snippet(false, ['fooLang'], 'bbb', 'bbb', '', 'value', '', SnippetSource.User, generateUuid()),
			// new Snippet(['fooLang'], '\'ccc', '\'ccc', '', 'value', '', SnippetSource.User, generateUuid())
		]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());

		const model = instantiateTextModel(instantiationService, '\'\'', 'fooLang');
		const result = await provider.provideCompletionItems(
			model,
			new Position(1, 2),
			{ triggerKind: CompletionTriggerKind.TriggerCharacter, triggerCharacter: '\'' }
		)!;

		assert.strictEqual(result.suggestions.length, 0);
		model.dispose();

	});

	test('still show suggestions in string when disable string suggestion #136611 (part 2)', async function () {

		snippetService = new SimpleSnippetService([
			new Snippet(false, ['fooLang'], 'aaa', 'aaa', '', 'value', '', SnippetSource.User, generateUuid()),
			new Snippet(false, ['fooLang'], 'bbb', 'bbb', '', 'value', '', SnippetSource.User, generateUuid()),
			new Snippet(false, ['fooLang'], '\'ccc', '\'ccc', '', 'value', '', SnippetSource.User, generateUuid())
		]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());

		const model = instantiateTextModel(instantiationService, '\'\'', 'fooLang');

		const result = await provider.provideCompletionItems(
			model,
			new Position(1, 2),
			{ triggerKind: CompletionTriggerKind.TriggerCharacter, triggerCharacter: '\'' }
		)!;

		assert.strictEqual(result.suggestions.length, 1);
		model.dispose();
	});

	test('Snippet suggestions are too eager #138707 (word)', async function () {
		snippetService = new SimpleSnippetService([
			new Snippet(false, ['fooLang'], 'tys', 'tys', '', 'value', '', SnippetSource.User, generateUuid()),
			new Snippet(false, ['fooLang'], 'hell_or_tell', 'hell_or_tell', '', 'value', '', SnippetSource.User, generateUuid()),
			new Snippet(false, ['fooLang'], '^y', '^y', '', 'value', '', SnippetSource.User, generateUuid()),
		]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());
		const model = instantiateTextModel(instantiationService, '\'hellot\'', 'fooLang');

		const result = await provider.provideCompletionItems(
			model,
			new Position(1, 8),
			{ triggerKind: CompletionTriggerKind.Invoke }
		)!;

		assert.strictEqual(result.suggestions.length, 1);
		assert.strictEqual((<SnippetCompletion>result.suggestions[0]).label.label, 'hell_or_tell');
		model.dispose();
	});

	test('Snippet suggestions are too eager #138707 (no word)', async function () {
		snippetService = new SimpleSnippetService([
			new Snippet(false, ['fooLang'], 'tys', 'tys', '', 'value', '', SnippetSource.User, generateUuid()),
			new Snippet(false, ['fooLang'], 't', 't', '', 'value', '', SnippetSource.User, generateUuid()),
			new Snippet(false, ['fooLang'], '^y', '^y', '', 'value', '', SnippetSource.User, generateUuid()),
		]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());
		const model = instantiateTextModel(instantiationService, ')*&^', 'fooLang');

		const result = await provider.provideCompletionItems(
			model,
			new Position(1, 5),
			{ triggerKind: CompletionTriggerKind.Invoke }
		)!;

		assert.strictEqual(result.suggestions.length, 1);
		assert.strictEqual((<SnippetCompletion>result.suggestions[0]).label.label, '^y');
		model.dispose();
	});

	test('Snippet suggestions are too eager #138707 (word/word)', async function () {
		snippetService = new SimpleSnippetService([
			new Snippet(false, ['fooLang'], 'async arrow function', 'async arrow function', '', 'value', '', SnippetSource.User, generateUuid()),
			new Snippet(false, ['fooLang'], 'foobarrrrrr', 'foobarrrrrr', '', 'value', '', SnippetSource.User, generateUuid()),
		]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());
		const model = instantiateTextModel(instantiationService, 'foobar', 'fooLang');

		const result = await provider.provideCompletionItems(
			model,
			new Position(1, 7),
			{ triggerKind: CompletionTriggerKind.Invoke }
		)!;

		assert.strictEqual(result.suggestions.length, 1);
		assert.strictEqual((<SnippetCompletion>result.suggestions[0]).label.label, 'foobarrrrrr');
		model.dispose();
	});

	test('Strange and useless autosuggestion #region/#endregion PHP #140039', async function () {
		snippetService = new SimpleSnippetService([
			new Snippet(false, ['fooLang'], 'reg', '#region', '', 'value', '', SnippetSource.User, generateUuid()),
		]);


		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());
		const model = instantiateTextModel(instantiationService, 'function abc(w)', 'fooLang');
		const result = await provider.provideCompletionItems(
			model,
			new Position(1, 15),
			{ triggerKind: CompletionTriggerKind.Invoke }
		)!;

		assert.strictEqual(result.suggestions.length, 0);
		model.dispose();
	});

	test.skip('Snippets disappear with . key #145960', async function () {
		snippetService = new SimpleSnippetService([
			new Snippet(false, ['fooLang'], 'div', 'div', '', 'div', '', SnippetSource.User, generateUuid()),
			new Snippet(false, ['fooLang'], 'div.', 'div.', '', 'div.', '', SnippetSource.User, generateUuid()),
			new Snippet(false, ['fooLang'], 'div#', 'div#', '', 'div#', '', SnippetSource.User, generateUuid()),
		]);

		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());
		const model = instantiateTextModel(instantiationService, 'di', 'fooLang');
		const result = await provider.provideCompletionItems(
			model,
			new Position(1, 3),
			{ triggerKind: CompletionTriggerKind.Invoke }
		)!;

		assert.strictEqual(result.suggestions.length, 3);


		model.applyEdits([EditOperation.insert(new Position(1, 3), '.')]);
		assert.strictEqual(model.getValue(), 'di.');
		const result2 = await provider.provideCompletionItems(
			model,
			new Position(1, 4),
			{ triggerKind: CompletionTriggerKind.TriggerCharacter, triggerCharacter: '.' }
		)!;

		assert.strictEqual(result2.suggestions.length, 1);
		assert.strictEqual(result2.suggestions[0].insertText, 'div.');

		model.dispose();
	});

	test('Hyphen in snippet prefix de-indents snippet #139016', async function () {
		snippetService = new SimpleSnippetService([
			new Snippet(false, ['fooLang'], 'foo', 'Foo- Bar', '', 'Foo', '', SnippetSource.User, generateUuid()),
		]);
		const model = instantiateTextModel(instantiationService, '    bar', 'fooLang');
		const provider = new SnippetCompletionProvider(languageService, snippetService, new TestLanguageConfigurationService());
		const result = await provider.provideCompletionItems(
			model,
			new Position(1, 8),
			{ triggerKind: CompletionTriggerKind.Invoke }
		);

		assert.strictEqual(result.suggestions.length, 1);
		const first = result.suggestions[0];
		assert.strictEqual((<CompletionItemRanges>first.range).insert.startColumn, 5);
	});
});
