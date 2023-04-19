/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { SnippetFile, Snippet, SnippetSource } from 'vs/workbench/contrib/snippets/browser/snippetsFile';
import { URI } from 'vs/base/common/uri';
import { SnippetParser } from 'vs/editor/contrib/snippet/browser/snippetParser';

suite('Snippets', function () {

	class TestSnippetFile extends SnippetFile {
		constructor(filepath: URI, snippets: Snippet[]) {
			super(SnippetSource.Extension, filepath, undefined, undefined, undefined!, undefined!);
			this.data.push(...snippets);
		}
	}

	test('SnippetFile#select', () => {
		let file = new TestSnippetFile(URI.file('somepath/foo.code-snippets'), []);
		let bucket: Snippet[] = [];
		file.select('', bucket);
		assert.strictEqual(bucket.length, 0);

		file = new TestSnippetFile(URI.file('somepath/foo.code-snippets'), [
			new Snippet(['foo'], 'FooSnippet1', 'foo', '', 'snippet', 'test', SnippetSource.User),
			new Snippet(['foo'], 'FooSnippet2', 'foo', '', 'snippet', 'test', SnippetSource.User),
			new Snippet(['bar'], 'BarSnippet1', 'foo', '', 'snippet', 'test', SnippetSource.User),
			new Snippet(['bar.comment'], 'BarSnippet2', 'foo', '', 'snippet', 'test', SnippetSource.User),
			new Snippet(['bar.strings'], 'BarSnippet2', 'foo', '', 'snippet', 'test', SnippetSource.User),
			new Snippet(['bazz', 'bazz'], 'BazzSnippet1', 'foo', '', 'snippet', 'test', SnippetSource.User),
		]);

		bucket = [];
		file.select('foo', bucket);
		assert.strictEqual(bucket.length, 2);

		bucket = [];
		file.select('fo', bucket);
		assert.strictEqual(bucket.length, 0);

		bucket = [];
		file.select('bar', bucket);
		assert.strictEqual(bucket.length, 1);

		bucket = [];
		file.select('bar.comment', bucket);
		assert.strictEqual(bucket.length, 2);

		bucket = [];
		file.select('bazz', bucket);
		assert.strictEqual(bucket.length, 1);
	});

	test('SnippetFile#select - any scope', function () {

		let file = new TestSnippetFile(URI.file('somepath/foo.code-snippets'), [
			new Snippet([], 'AnySnippet1', 'foo', '', 'snippet', 'test', SnippetSource.User),
			new Snippet(['foo'], 'FooSnippet1', 'foo', '', 'snippet', 'test', SnippetSource.User),
		]);

		let bucket: Snippet[] = [];
		file.select('foo', bucket);
		assert.strictEqual(bucket.length, 2);

	});

	test('Snippet#needsClipboard', function () {

		function assertNeedsClipboard(body: string, expected: boolean): void {
			let snippet = new Snippet(['foo'], 'FooSnippet1', 'foo', '', body, 'test', SnippetSource.User);
			assert.strictEqual(snippet.needsClipboard, expected);

			assert.strictEqual(SnippetParser.guessNeedsClipboard(body), expected);
		}

		assertNeedsClipboard('foo$CLIPBOARD', true);
		assertNeedsClipboard('${CLIPBOARD}', true);
		assertNeedsClipboard('foo${CLIPBOARD}bar', true);
		assertNeedsClipboard('foo$clipboard', false);
		assertNeedsClipboard('foo${clipboard}', false);
		assertNeedsClipboard('baba', false);
	});

	test('Snippet#isTrivial', function () {

		function assertIsTrivial(body: string, expected: boolean): void {
			let snippet = new Snippet(['foo'], 'FooSnippet1', 'foo', '', body, 'test', SnippetSource.User);
			assert.strictEqual(snippet.isTrivial, expected);
		}

		assertIsTrivial('foo', true);
		assertIsTrivial('foo$0', true);
		assertIsTrivial('foo$0bar', false);
		assertIsTrivial('foo$1', false);
		assertIsTrivial('foo$1$0', false);
		assertIsTrivial('${1:foo}', false);
	});

});
