/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { guessMimeTypes, normalizeMimeType, registerTextMime } from 'vs/base/common/mime';
import { URI } from 'vs/base/common/uri';

suite('Mime', () => {

	test('Dynamically Register Text Mime', () => {
		let guess = guessMimeTypes(URI.file('foo.monaco'));
		assert.deepStrictEqual(guess, ['application/unknown']);

		registerTextMime({ id: 'monaco', extension: '.monaco', mime: 'text/monaco' });
		guess = guessMimeTypes(URI.file('foo.monaco'));
		assert.deepStrictEqual(guess, ['text/monaco', 'text/plain']);

		guess = guessMimeTypes(URI.file('.monaco'));
		assert.deepStrictEqual(guess, ['text/monaco', 'text/plain']);

		registerTextMime({ id: 'codefile', filename: 'Codefile', mime: 'text/code' });
		guess = guessMimeTypes(URI.file('Codefile'));
		assert.deepStrictEqual(guess, ['text/code', 'text/plain']);

		guess = guessMimeTypes(URI.file('foo.Codefile'));
		assert.deepStrictEqual(guess, ['application/unknown']);

		registerTextMime({ id: 'docker', filepattern: 'Docker*', mime: 'text/docker' });
		guess = guessMimeTypes(URI.file('Docker-debug'));
		assert.deepStrictEqual(guess, ['text/docker', 'text/plain']);

		guess = guessMimeTypes(URI.file('docker-PROD'));
		assert.deepStrictEqual(guess, ['text/docker', 'text/plain']);

		registerTextMime({ id: 'niceregex', mime: 'text/nice-regex', firstline: /RegexesAreNice/ });
		guess = guessMimeTypes(URI.file('Randomfile.noregistration'), 'RegexesAreNice');
		assert.deepStrictEqual(guess, ['text/nice-regex', 'text/plain']);

		guess = guessMimeTypes(URI.file('Randomfile.noregistration'), 'RegexesAreNotNice');
		assert.deepStrictEqual(guess, ['application/unknown']);

		guess = guessMimeTypes(URI.file('Codefile'), 'RegexesAreNice');
		assert.deepStrictEqual(guess, ['text/code', 'text/plain']);
	});

	test('Mimes Priority', () => {
		registerTextMime({ id: 'monaco', extension: '.monaco', mime: 'text/monaco' });
		registerTextMime({ id: 'foobar', mime: 'text/foobar', firstline: /foobar/ });

		let guess = guessMimeTypes(URI.file('foo.monaco'));
		assert.deepStrictEqual(guess, ['text/monaco', 'text/plain']);

		guess = guessMimeTypes(URI.file('foo.monaco'), 'foobar');
		assert.deepStrictEqual(guess, ['text/monaco', 'text/plain']);

		registerTextMime({ id: 'docker', filename: 'dockerfile', mime: 'text/winner' });
		registerTextMime({ id: 'docker', filepattern: 'dockerfile*', mime: 'text/looser' });
		guess = guessMimeTypes(URI.file('dockerfile'));
		assert.deepStrictEqual(guess, ['text/winner', 'text/plain']);

		registerTextMime({ id: 'azure-looser', mime: 'text/azure-looser', firstline: /azure/ });
		registerTextMime({ id: 'azure-winner', mime: 'text/azure-winner', firstline: /azure/ });
		guess = guessMimeTypes(URI.file('azure'), 'azure');
		assert.deepStrictEqual(guess, ['text/azure-winner', 'text/plain']);
	});

	test('Specificity priority 1', () => {
		registerTextMime({ id: 'monaco2', extension: '.monaco2', mime: 'text/monaco2' });
		registerTextMime({ id: 'monaco2', filename: 'specific.monaco2', mime: 'text/specific-monaco2' });

		assert.deepStrictEqual(guessMimeTypes(URI.file('specific.monaco2')), ['text/specific-monaco2', 'text/plain']);
		assert.deepStrictEqual(guessMimeTypes(URI.file('foo.monaco2')), ['text/monaco2', 'text/plain']);
	});

	test('Specificity priority 2', () => {
		registerTextMime({ id: 'monaco3', filename: 'specific.monaco3', mime: 'text/specific-monaco3' });
		registerTextMime({ id: 'monaco3', extension: '.monaco3', mime: 'text/monaco3' });

		assert.deepStrictEqual(guessMimeTypes(URI.file('specific.monaco3')), ['text/specific-monaco3', 'text/plain']);
		assert.deepStrictEqual(guessMimeTypes(URI.file('foo.monaco3')), ['text/monaco3', 'text/plain']);
	});

	test('Mimes Priority - Longest Extension wins', () => {
		registerTextMime({ id: 'monaco', extension: '.monaco', mime: 'text/monaco' });
		registerTextMime({ id: 'monaco', extension: '.monaco.xml', mime: 'text/monaco-xml' });
		registerTextMime({ id: 'monaco', extension: '.monaco.xml.build', mime: 'text/monaco-xml-build' });

		let guess = guessMimeTypes(URI.file('foo.monaco'));
		assert.deepStrictEqual(guess, ['text/monaco', 'text/plain']);

		guess = guessMimeTypes(URI.file('foo.monaco.xml'));
		assert.deepStrictEqual(guess, ['text/monaco-xml', 'text/plain']);

		guess = guessMimeTypes(URI.file('foo.monaco.xml.build'));
		assert.deepStrictEqual(guess, ['text/monaco-xml-build', 'text/plain']);
	});

	test('Mimes Priority - User configured wins', () => {
		registerTextMime({ id: 'monaco', extension: '.monaco.xnl', mime: 'text/monaco', userConfigured: true });
		registerTextMime({ id: 'monaco', extension: '.monaco.xml', mime: 'text/monaco-xml' });

		let guess = guessMimeTypes(URI.file('foo.monaco.xnl'));
		assert.deepStrictEqual(guess, ['text/monaco', 'text/plain']);
	});

	test('Mimes Priority - Pattern matches on path if specified', () => {
		registerTextMime({ id: 'monaco', filepattern: '**/dot.monaco.xml', mime: 'text/monaco' });
		registerTextMime({ id: 'other', filepattern: '*ot.other.xml', mime: 'text/other' });

		let guess = guessMimeTypes(URI.file('/some/path/dot.monaco.xml'));
		assert.deepStrictEqual(guess, ['text/monaco', 'text/plain']);
	});

	test('Mimes Priority - Last registered mime wins', () => {
		registerTextMime({ id: 'monaco', filepattern: '**/dot.monaco.xml', mime: 'text/monaco' });
		registerTextMime({ id: 'other', filepattern: '**/dot.monaco.xml', mime: 'text/other' });

		let guess = guessMimeTypes(URI.file('/some/path/dot.monaco.xml'));
		assert.deepStrictEqual(guess, ['text/other', 'text/plain']);
	});

	test('Data URIs', () => {
		registerTextMime({ id: 'data', extension: '.data', mime: 'text/data' });

		assert.deepStrictEqual(guessMimeTypes(URI.parse(`data:;label:something.data;description:data,`)), ['text/data', 'text/plain']);
	});

	test('normalize', () => {
		assert.strictEqual(normalizeMimeType('invalid'), 'invalid');
		assert.strictEqual(normalizeMimeType('invalid', true), undefined);
		assert.strictEqual(normalizeMimeType('Text/plain'), 'text/plain');
		assert.strictEqual(normalizeMimeType('Text/pläin'), 'text/pläin');
		assert.strictEqual(normalizeMimeType('Text/plain;UPPER'), 'text/plain;UPPER');
		assert.strictEqual(normalizeMimeType('Text/plain;lower'), 'text/plain;lower');
	});
});
