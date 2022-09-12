/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { URI } from 'vs/base/common/uri';
import { LanguagesRegistry } from 'vs/editor/common/services/languagesRegistry';

suite('LanguagesRegistry', () => {

	test('output mode does not have a name', () => {
		let registry = new LanguagesRegistry(false);

		registry._registerLanguages([{
			id: 'outputModeId',
			extensions: [],
			aliases: [],
			mimetypes: ['outputModeMimeType'],
		}]);

		assert.deepStrictEqual(registry.getRegisteredLanguageNames(), []);

		registry.dispose();
	});

	test('mode with alias does have a name', () => {
		let registry = new LanguagesRegistry(false);

		registry._registerLanguages([{
			id: 'modeId',
			extensions: [],
			aliases: ['ModeName'],
			mimetypes: ['bla'],
		}]);

		assert.deepStrictEqual(registry.getRegisteredLanguageNames(), ['ModeName']);
		assert.deepStrictEqual(registry.getLanguageName('modeId'), 'ModeName');

		registry.dispose();
	});

	test('mode without alias gets a name', () => {
		let registry = new LanguagesRegistry(false);

		registry._registerLanguages([{
			id: 'modeId',
			extensions: [],
			mimetypes: ['bla'],
		}]);

		assert.deepStrictEqual(registry.getRegisteredLanguageNames(), ['modeId']);
		assert.deepStrictEqual(registry.getLanguageName('modeId'), 'modeId');

		registry.dispose();
	});

	test('bug #4360: f# not shown in status bar', () => {
		let registry = new LanguagesRegistry(false);

		registry._registerLanguages([{
			id: 'modeId',
			extensions: ['.ext1'],
			aliases: ['ModeName'],
			mimetypes: ['bla'],
		}]);

		registry._registerLanguages([{
			id: 'modeId',
			extensions: ['.ext2'],
			aliases: [],
			mimetypes: ['bla'],
		}]);

		assert.deepStrictEqual(registry.getRegisteredLanguageNames(), ['ModeName']);
		assert.deepStrictEqual(registry.getLanguageName('modeId'), 'ModeName');

		registry.dispose();
	});

	test('issue #5278: Extension cannot override language name anymore', () => {
		let registry = new LanguagesRegistry(false);

		registry._registerLanguages([{
			id: 'modeId',
			extensions: ['.ext1'],
			aliases: ['ModeName'],
			mimetypes: ['bla'],
		}]);

		registry._registerLanguages([{
			id: 'modeId',
			extensions: ['.ext2'],
			aliases: ['BetterModeName'],
			mimetypes: ['bla'],
		}]);

		assert.deepStrictEqual(registry.getRegisteredLanguageNames(), ['BetterModeName']);
		assert.deepStrictEqual(registry.getLanguageName('modeId'), 'BetterModeName');

		registry.dispose();
	});

	test('mimetypes are generated if necessary', () => {
		let registry = new LanguagesRegistry(false);

		registry._registerLanguages([{
			id: 'modeId'
		}]);

		assert.deepStrictEqual(registry.getMimeForMode('modeId'), 'text/x-modeId');

		registry.dispose();
	});

	test('first mimetype wins', () => {
		let registry = new LanguagesRegistry(false);

		registry._registerLanguages([{
			id: 'modeId',
			mimetypes: ['text/modeId', 'text/modeId2']
		}]);

		assert.deepStrictEqual(registry.getMimeForMode('modeId'), 'text/modeId');

		registry.dispose();
	});

	test('first mimetype wins 2', () => {
		let registry = new LanguagesRegistry(false);

		registry._registerLanguages([{
			id: 'modeId'
		}]);

		registry._registerLanguages([{
			id: 'modeId',
			mimetypes: ['text/modeId']
		}]);

		assert.deepStrictEqual(registry.getMimeForMode('modeId'), 'text/x-modeId');

		registry.dispose();
	});

	test('aliases', () => {
		let registry = new LanguagesRegistry(false);

		registry._registerLanguages([{
			id: 'a'
		}]);

		assert.deepStrictEqual(registry.getRegisteredLanguageNames(), ['a']);
		assert.deepStrictEqual(registry.getModeIdFromLanguageName('a'), 'a');
		assert.deepStrictEqual(registry.getModeIdForLanguageNameLowercase('a'), 'a');
		assert.deepStrictEqual(registry.getLanguageName('a'), 'a');

		registry._registerLanguages([{
			id: 'a',
			aliases: ['A1', 'A2']
		}]);

		assert.deepStrictEqual(registry.getRegisteredLanguageNames(), ['A1']);
		assert.deepStrictEqual(registry.getModeIdFromLanguageName('a'), null);
		assert.deepStrictEqual(registry.getModeIdFromLanguageName('A1'), 'a');
		assert.deepStrictEqual(registry.getModeIdFromLanguageName('A2'), null);
		assert.deepStrictEqual(registry.getModeIdForLanguageNameLowercase('a'), 'a');
		assert.deepStrictEqual(registry.getModeIdForLanguageNameLowercase('a1'), 'a');
		assert.deepStrictEqual(registry.getModeIdForLanguageNameLowercase('a2'), 'a');
		assert.deepStrictEqual(registry.getLanguageName('a'), 'A1');

		registry._registerLanguages([{
			id: 'a',
			aliases: ['A3', 'A4']
		}]);

		assert.deepStrictEqual(registry.getRegisteredLanguageNames(), ['A3']);
		assert.deepStrictEqual(registry.getModeIdFromLanguageName('a'), null);
		assert.deepStrictEqual(registry.getModeIdFromLanguageName('A1'), null);
		assert.deepStrictEqual(registry.getModeIdFromLanguageName('A2'), null);
		assert.deepStrictEqual(registry.getModeIdFromLanguageName('A3'), 'a');
		assert.deepStrictEqual(registry.getModeIdFromLanguageName('A4'), null);
		assert.deepStrictEqual(registry.getModeIdForLanguageNameLowercase('a'), 'a');
		assert.deepStrictEqual(registry.getModeIdForLanguageNameLowercase('a1'), 'a');
		assert.deepStrictEqual(registry.getModeIdForLanguageNameLowercase('a2'), 'a');
		assert.deepStrictEqual(registry.getModeIdForLanguageNameLowercase('a3'), 'a');
		assert.deepStrictEqual(registry.getModeIdForLanguageNameLowercase('a4'), 'a');
		assert.deepStrictEqual(registry.getLanguageName('a'), 'A3');

		registry.dispose();
	});

	test('empty aliases array means no alias', () => {
		let registry = new LanguagesRegistry(false);

		registry._registerLanguages([{
			id: 'a'
		}]);

		assert.deepStrictEqual(registry.getRegisteredLanguageNames(), ['a']);
		assert.deepStrictEqual(registry.getModeIdFromLanguageName('a'), 'a');
		assert.deepStrictEqual(registry.getModeIdForLanguageNameLowercase('a'), 'a');
		assert.deepStrictEqual(registry.getLanguageName('a'), 'a');

		registry._registerLanguages([{
			id: 'b',
			aliases: []
		}]);

		assert.deepStrictEqual(registry.getRegisteredLanguageNames(), ['a']);
		assert.deepStrictEqual(registry.getModeIdFromLanguageName('a'), 'a');
		assert.deepStrictEqual(registry.getModeIdFromLanguageName('b'), null);
		assert.deepStrictEqual(registry.getModeIdForLanguageNameLowercase('a'), 'a');
		assert.deepStrictEqual(registry.getModeIdForLanguageNameLowercase('b'), 'b');
		assert.deepStrictEqual(registry.getLanguageName('a'), 'a');
		assert.deepStrictEqual(registry.getLanguageName('b'), null);

		registry.dispose();
	});

	test('extensions', () => {
		let registry = new LanguagesRegistry(false);

		registry._registerLanguages([{
			id: 'a',
			aliases: ['aName'],
			extensions: ['aExt']
		}]);

		assert.deepStrictEqual(registry.getExtensions('a'), []);
		assert.deepStrictEqual(registry.getExtensions('aname'), []);
		assert.deepStrictEqual(registry.getExtensions('aName'), ['aExt']);

		registry._registerLanguages([{
			id: 'a',
			extensions: ['aExt2']
		}]);

		assert.deepStrictEqual(registry.getExtensions('a'), []);
		assert.deepStrictEqual(registry.getExtensions('aname'), []);
		assert.deepStrictEqual(registry.getExtensions('aName'), ['aExt', 'aExt2']);

		registry.dispose();
	});

	test('extensions of primary language registration come first', () => {
		let registry = new LanguagesRegistry(false);

		registry._registerLanguages([{
			id: 'a',
			extensions: ['aExt3']
		}]);

		assert.deepStrictEqual(registry.getExtensions('a')[0], 'aExt3');

		registry._registerLanguages([{
			id: 'a',
			configuration: URI.file('conf.json'),
			extensions: ['aExt']
		}]);

		assert.deepStrictEqual(registry.getExtensions('a')[0], 'aExt');

		registry._registerLanguages([{
			id: 'a',
			extensions: ['aExt2']
		}]);

		assert.deepStrictEqual(registry.getExtensions('a')[0], 'aExt');

		registry.dispose();
	});

	test('filenames', () => {
		let registry = new LanguagesRegistry(false);

		registry._registerLanguages([{
			id: 'a',
			aliases: ['aName'],
			filenames: ['aFilename']
		}]);

		assert.deepStrictEqual(registry.getFilenames('a'), []);
		assert.deepStrictEqual(registry.getFilenames('aname'), []);
		assert.deepStrictEqual(registry.getFilenames('aName'), ['aFilename']);

		registry._registerLanguages([{
			id: 'a',
			filenames: ['aFilename2']
		}]);

		assert.deepStrictEqual(registry.getFilenames('a'), []);
		assert.deepStrictEqual(registry.getFilenames('aname'), []);
		assert.deepStrictEqual(registry.getFilenames('aName'), ['aFilename', 'aFilename2']);

		registry.dispose();
	});

	test('configuration', () => {
		let registry = new LanguagesRegistry(false);

		registry._registerLanguages([{
			id: 'a',
			aliases: ['aName'],
			configuration: URI.file('/path/to/aFilename')
		}]);

		assert.deepStrictEqual(registry.getConfigurationFiles('a'), [URI.file('/path/to/aFilename')]);
		assert.deepStrictEqual(registry.getConfigurationFiles('aname'), []);
		assert.deepStrictEqual(registry.getConfigurationFiles('aName'), []);

		registry._registerLanguages([{
			id: 'a',
			configuration: URI.file('/path/to/aFilename2')
		}]);

		assert.deepStrictEqual(registry.getConfigurationFiles('a'), [URI.file('/path/to/aFilename'), URI.file('/path/to/aFilename2')]);
		assert.deepStrictEqual(registry.getConfigurationFiles('aname'), []);
		assert.deepStrictEqual(registry.getConfigurationFiles('aName'), []);

		registry.dispose();
	});
});
