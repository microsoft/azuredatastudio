/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ITerminalSimpleLink, TerminalBuiltinLinkType } from 'vs/workbench/contrib/terminal/browser/links/links';
import { TerminalWordLinkDetector } from 'vs/workbench/contrib/terminal/browser/links/terminalWordLinkDetector';
import { assertLinkHelper } from 'vs/workbench/contrib/terminal/test/browser/links/linkTestUtils';
import { Terminal } from 'xterm';

suite('Workbench - TerminalWordLinkDetector', () => {
	let configurationService: TestConfigurationService;
	let detector: TerminalWordLinkDetector;
	let xterm: Terminal;

	setup(() => {
		const instantiationService = new TestInstantiationService();
		configurationService = new TestConfigurationService();

		instantiationService.stub(IConfigurationService, configurationService);

		xterm = new Terminal({ cols: 80, rows: 30 });
		detector = instantiationService.createInstance(TerminalWordLinkDetector, xterm);
	});

	async function assertLink(
		text: string,
		expected: (Pick<ITerminalSimpleLink, 'text'> & { range: [number, number][] })[]
	) {
		await assertLinkHelper(text, expected, detector, TerminalBuiltinLinkType.Search);
	}

	test('should link words as defined by wordSeparators', async () => {
		await configurationService.setUserConfiguration('terminal', { integrated: { wordSeparators: ' ()[]' } });
		await assertLink('foo', [{ range: [[1, 1], [3, 1]], text: 'foo' }]);
		await assertLink('foo', [{ range: [[1, 1], [3, 1]], text: 'foo' }]);
		await assertLink('foo', [{ range: [[1, 1], [3, 1]], text: 'foo' }]);
		await assertLink(' foo ', [{ range: [[2, 1], [4, 1]], text: 'foo' }]);
		await assertLink('(foo)', [{ range: [[2, 1], [4, 1]], text: 'foo' }]);
		await assertLink('[foo]', [{ range: [[2, 1], [4, 1]], text: 'foo' }]);
		await assertLink('{foo}', [{ range: [[1, 1], [5, 1]], text: '{foo}' }]);

		await configurationService.setUserConfiguration('terminal', { integrated: { wordSeparators: ' ' } });
		await assertLink('foo', [{ range: [[1, 1], [3, 1]], text: 'foo' }]);
		await assertLink(' foo ', [{ range: [[2, 1], [4, 1]], text: 'foo' }]);
		await assertLink('(foo)', [{ range: [[1, 1], [5, 1]], text: '(foo)' }]);
		await assertLink('[foo]', [{ range: [[1, 1], [5, 1]], text: '[foo]' }]);
		await assertLink('{foo}', [{ range: [[1, 1], [5, 1]], text: '{foo}' }]);

		await configurationService.setUserConfiguration('terminal', { integrated: { wordSeparators: ' []' } });
		await assertLink('aabbccdd.txt ', [{ range: [[1, 1], [12, 1]], text: 'aabbccdd.txt' }]);
		await assertLink(' aabbccdd.txt ', [{ range: [[2, 1], [13, 1]], text: 'aabbccdd.txt' }]);
		await assertLink(' [aabbccdd.txt] ', [{ range: [[3, 1], [14, 1]], text: 'aabbccdd.txt' }]);
	});

	// These are failing - the link's start x is 1 px too far to the right bc it starts
	// with a wide character, which the terminalLinkHelper currently doesn't account for
	test.skip('should support wide characters', async () => {
		await configurationService.setUserConfiguration('terminal', { integrated: { wordSeparators: ' []' } });
		await assertLink('我是学生.txt ', [{ range: [[1, 1], [12, 1]], text: '我是学生.txt' }]);
		await assertLink(' 我是学生.txt ', [{ range: [[2, 1], [13, 1]], text: '我是学生.txt' }]);
		await assertLink(' [我是学生.txt] ', [{ range: [[3, 1], [14, 1]], text: '我是学生.txt' }]);
	});

	test('should support multiple link results', async () => {
		await configurationService.setUserConfiguration('terminal', { integrated: { wordSeparators: ' ' } });
		await assertLink('foo bar', [
			{ range: [[1, 1], [3, 1]], text: 'foo' },
			{ range: [[5, 1], [7, 1]], text: 'bar' }
		]);
	});

	test('should remove trailing colon in the link results', async () => {
		await configurationService.setUserConfiguration('terminal', { integrated: { wordSeparators: ' ' } });
		await assertLink('foo:5:6: bar:0:32:', [
			{ range: [[1, 1], [7, 1]], text: 'foo:5:6' },
			{ range: [[10, 1], [17, 1]], text: 'bar:0:32' }
		]);
	});

	test('should support wrapping', async () => {
		await configurationService.setUserConfiguration('terminal', { integrated: { wordSeparators: ' ' } });
		await assertLink('fsdjfsdkfjslkdfjskdfjsldkfjsdlkfjslkdjfskldjflskdfjskldjflskdfjsdklfjsdklfjsldkfjsdlkfjsdlkfjsdlkfjsldkfjslkdfjsdlkfjsldkfjsdlkfjskdfjsldkfjsdlkfjslkdfjsdlkfjsldkfjsldkfjsldkfjslkdfjsdlkfjslkdfjsdklfsd', [
			{ range: [[1, 1], [41, 3]], text: 'fsdjfsdkfjslkdfjskdfjsldkfjsdlkfjslkdjfskldjflskdfjskldjflskdfjsdklfjsdklfjsldkfjsdlkfjsdlkfjsdlkfjsldkfjslkdfjsdlkfjsldkfjsdlkfjskdfjsldkfjsdlkfjslkdfjsdlkfjsldkfjsldkfjsldkfjslkdfjsdlkfjslkdfjsdklfsd' },
		]);
	});
	test('should support wrapping with multiple links', async () => {
		await configurationService.setUserConfiguration('terminal', { integrated: { wordSeparators: ' ' } });
		await assertLink('fsdjfsdkfjslkdfjskdfjsldkfj sdlkfjslkdjfskldjflskdfjskldjflskdfj sdklfjsdklfjsldkfjsdlkfjsdlkfjsdlkfjsldkfjslkdfjsdlkfjsldkfjsdlkfjskdfjsldkfjsdlkfjslkdfjsdlkfjsldkfjsldkfjsldkfjslkdfjsdlkfjslkdfjsdklfsd', [
			{ range: [[1, 1], [27, 1]], text: 'fsdjfsdkfjslkdfjskdfjsldkfj' },
			{ range: [[29, 1], [64, 1]], text: 'sdlkfjslkdjfskldjflskdfjskldjflskdfj' },
			{ range: [[66, 1], [43, 3]], text: 'sdklfjsdklfjsldkfjsdlkfjsdlkfjsdlkfjsldkfjslkdfjsdlkfjsldkfjsdlkfjskdfjsldkfjsdlkfjslkdfjsdlkfjsldkfjsldkfjsldkfjslkdfjsdlkfjslkdfjsdklfsd' }
		]);
	});
	test('does not return any links for empty text', async () => {
		await configurationService.setUserConfiguration('terminal', { integrated: { wordSeparators: ' ' } });
		await assertLink('', []);
	});
	test('should support file scheme links', async () => {
		await configurationService.setUserConfiguration('terminal', { integrated: { wordSeparators: ' ' } });
		await assertLink('file:///C:/users/test/file.txt ', [{ range: [[1, 1], [30, 1]], text: 'file:///C:/users/test/file.txt' }]);
		await assertLink('file:///C:/users/test/file.txt:1:10 ', [{ range: [[1, 1], [35, 1]], text: 'file:///C:/users/test/file.txt:1:10' }]);
	});
});
