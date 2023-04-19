/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ITerminalSimpleLink, TerminalBuiltinLinkType } from 'vs/workbench/contrib/terminal/browser/links/links';
import { TerminalUriLinkDetector } from 'vs/workbench/contrib/terminal/browser/links/terminalUriLinkDetector';
import { assertLinkHelper, resolveLinkForTest } from 'vs/workbench/contrib/terminal/test/browser/links/linkTestUtils';
import { Terminal } from 'xterm';

suite('Workbench - TerminalUriLinkDetector', () => {
	let configurationService: TestConfigurationService;
	let detector: TerminalUriLinkDetector;
	let xterm: Terminal;

	setup(() => {
		const instantiationService = new TestInstantiationService();
		configurationService = new TestConfigurationService();

		instantiationService.stub(IConfigurationService, configurationService);

		xterm = new Terminal({ cols: 80, rows: 30 });
		detector = instantiationService.createInstance(TerminalUriLinkDetector, xterm, resolveLinkForTest);
	});

	async function assertLink(
		type: TerminalBuiltinLinkType,
		text: string,
		expected: (Pick<ITerminalSimpleLink, 'text'> & { range: [number, number][] })[]
	) {
		await assertLinkHelper(text, expected, detector, type);
	}

	test('LinkComputer cases', async () => {
		await assertLink(TerminalBuiltinLinkType.Url, 'x = "http://foo.bar";', [{ range: [[6, 1], [19, 1]], text: 'http://foo.bar' }]);
		await assertLink(TerminalBuiltinLinkType.Url, 'x = (http://foo.bar);', [{ range: [[6, 1], [19, 1]], text: 'http://foo.bar' }]);
		await assertLink(TerminalBuiltinLinkType.Url, 'x = \'http://foo.bar\';', [{ range: [[6, 1], [19, 1]], text: 'http://foo.bar' }]);
		await assertLink(TerminalBuiltinLinkType.Url, 'x =  http://foo.bar ;', [{ range: [[6, 1], [19, 1]], text: 'http://foo.bar' }]);
		await assertLink(TerminalBuiltinLinkType.Url, 'x = <http://foo.bar>;', [{ range: [[6, 1], [19, 1]], text: 'http://foo.bar' }]);
		await assertLink(TerminalBuiltinLinkType.Url, 'x = {http://foo.bar};', [{ range: [[6, 1], [19, 1]], text: 'http://foo.bar' }]);
		await assertLink(TerminalBuiltinLinkType.Url, '(see http://foo.bar)', [{ range: [[6, 1], [19, 1]], text: 'http://foo.bar' }]);
		await assertLink(TerminalBuiltinLinkType.Url, '[see http://foo.bar]', [{ range: [[6, 1], [19, 1]], text: 'http://foo.bar' }]);
		await assertLink(TerminalBuiltinLinkType.Url, '{see http://foo.bar}', [{ range: [[6, 1], [19, 1]], text: 'http://foo.bar' }]);
		await assertLink(TerminalBuiltinLinkType.Url, '<see http://foo.bar>', [{ range: [[6, 1], [19, 1]], text: 'http://foo.bar' }]);
		await assertLink(TerminalBuiltinLinkType.Url, '<url>http://foo.bar</url>', [{ range: [[6, 1], [19, 1]], text: 'http://foo.bar' }]);
		await assertLink(TerminalBuiltinLinkType.Url, '// Click here to learn more. https://go.microsoft.com/fwlink/?LinkID=513275&clcid=0x409', [{ range: [[30, 1], [7, 2]], text: 'https://go.microsoft.com/fwlink/?LinkID=513275&clcid=0x409' }]);
		await assertLink(TerminalBuiltinLinkType.Url, '// Click here to learn more. https://msdn.microsoft.com/en-us/library/windows/desktop/aa365247(v=vs.85).aspx', [{ range: [[30, 1], [28, 2]], text: 'https://msdn.microsoft.com/en-us/library/windows/desktop/aa365247(v=vs.85).aspx' }]);
		await assertLink(TerminalBuiltinLinkType.Url, '// https://github.com/projectkudu/kudu/blob/master/Kudu.Core/Scripts/selectNodeVersion.js', [{ range: [[4, 1], [9, 2]], text: 'https://github.com/projectkudu/kudu/blob/master/Kudu.Core/Scripts/selectNodeVersion.js' }]);
		await assertLink(TerminalBuiltinLinkType.Url, '<!-- !!! Do not remove !!!   WebContentRef(link:https://go.microsoft.com/fwlink/?LinkId=166007, area:Admin, updated:2015, nextUpdate:2016, tags:SqlServer)   !!! Do not remove !!! -->', [{ range: [[49, 1], [14, 2]], text: 'https://go.microsoft.com/fwlink/?LinkId=166007' }]);
		await assertLink(TerminalBuiltinLinkType.Url, 'For instructions, see https://go.microsoft.com/fwlink/?LinkId=166007.</value>', [{ range: [[23, 1], [68, 1]], text: 'https://go.microsoft.com/fwlink/?LinkId=166007' }]);
		await assertLink(TerminalBuiltinLinkType.Url, 'For instructions, see https://msdn.microsoft.com/en-us/library/windows/desktop/aa365247(v=vs.85).aspx.</value>', [{ range: [[23, 1], [21, 2]], text: 'https://msdn.microsoft.com/en-us/library/windows/desktop/aa365247(v=vs.85).aspx' }]);
		await assertLink(TerminalBuiltinLinkType.Url, 'x = "https://en.wikipedia.org/wiki/Zürich";', [{ range: [[6, 1], [41, 1]], text: 'https://en.wikipedia.org/wiki/Zürich' }]);
		await assertLink(TerminalBuiltinLinkType.Url, '請參閱 http://go.microsoft.com/fwlink/?LinkId=761051。', [{ range: [[8, 1], [53, 1]], text: 'http://go.microsoft.com/fwlink/?LinkId=761051' }]);
		await assertLink(TerminalBuiltinLinkType.Url, '（請參閱 http://go.microsoft.com/fwlink/?LinkId=761051）', [{ range: [[10, 1], [55, 1]], text: 'http://go.microsoft.com/fwlink/?LinkId=761051' }]);
		await assertLink(TerminalBuiltinLinkType.LocalFile, 'x = "file:///foo.bar";', [{ range: [[6, 1], [20, 1]], text: 'file:///foo.bar' }]);
		await assertLink(TerminalBuiltinLinkType.LocalFile, 'x = "file://c:/foo.bar";', [{ range: [[6, 1], [22, 1]], text: 'file://c:/foo.bar' }]);
		await assertLink(TerminalBuiltinLinkType.LocalFile, 'x = "file://shares/foo.bar";', [{ range: [[6, 1], [26, 1]], text: 'file://shares/foo.bar' }]);
		await assertLink(TerminalBuiltinLinkType.LocalFile, 'x = "file://shäres/foo.bar";', [{ range: [[6, 1], [26, 1]], text: 'file://shäres/foo.bar' }]);
		await assertLink(TerminalBuiltinLinkType.Url, 'Some text, then http://www.bing.com.', [{ range: [[17, 1], [35, 1]], text: 'http://www.bing.com' }]);
		await assertLink(TerminalBuiltinLinkType.Url, 'let url = `http://***/_api/web/lists/GetByTitle(\'Teambuildingaanvragen\')/items`;', [{ range: [[12, 1], [78, 1]], text: 'http://***/_api/web/lists/GetByTitle(\'Teambuildingaanvragen\')/items' }]);
		await assertLink(TerminalBuiltinLinkType.Url, '7. At this point, ServiceMain has been called.  There is no functionality presently in ServiceMain, but you can consult the [MSDN documentation](https://msdn.microsoft.com/en-us/library/windows/desktop/ms687414(v=vs.85).aspx) to add functionality as desired!', [{ range: [[66, 2], [64, 3]], text: 'https://msdn.microsoft.com/en-us/library/windows/desktop/ms687414(v=vs.85).aspx' }]);
		await assertLink(TerminalBuiltinLinkType.Url, 'let x = "http://[::1]:5000/connect/token"', [{ range: [[10, 1], [40, 1]], text: 'http://[::1]:5000/connect/token' }]);
		await assertLink(TerminalBuiltinLinkType.Url, '2. Navigate to **https://portal.azure.com**', [{ range: [[18, 1], [41, 1]], text: 'https://portal.azure.com' }]);
		await assertLink(TerminalBuiltinLinkType.Url, 'POST|https://portal.azure.com|2019-12-05|', [{ range: [[6, 1], [29, 1]], text: 'https://portal.azure.com' }]);
		await assertLink(TerminalBuiltinLinkType.Url, 'aa  https://foo.bar/[this is foo site]  aa', [{ range: [[5, 1], [38, 1]], text: 'https://foo.bar/[this is foo site]' }]);
	});

	test('should support multiple link results', async () => {
		await assertLink(TerminalBuiltinLinkType.Url, 'http://foo.bar http://bar.foo', [
			{ range: [[1, 1], [14, 1]], text: 'http://foo.bar' },
			{ range: [[16, 1], [29, 1]], text: 'http://bar.foo' }
		]);
	});
	test('should not filtrer out https:// link that exceed 1024 characters', async () => {
		// 8 + 101 * 10 = 1018 characters
		await assertLink(TerminalBuiltinLinkType.Url, `https://${'foobarbaz/'.repeat(101)}`, [{
			range: [[1, 1], [58, 13]],
			text: `https://${'foobarbaz/'.repeat(101)}`
		}]);
		// 8 + 102 * 10 = 1028 characters
		await assertLink(TerminalBuiltinLinkType.Url, `https://${'foobarbaz/'.repeat(102)}`, [{
			range: [[1, 1], [68, 13]],
			text: `https://${'foobarbaz/'.repeat(102)}`
		}]);
	});
	test('should filter out file:// links that exceed 1024 characters', async () => {
		// 8 + 101 * 10 = 1018 characters
		await assertLink(TerminalBuiltinLinkType.LocalFile, `file:///${'foobarbaz/'.repeat(101)}`, [{
			text: `file:///${'foobarbaz/'.repeat(101)}`,
			range: [[1, 1], [58, 13]]
		}]);
		// 8 + 102 * 10 = 1028 characters
		await assertLink(TerminalBuiltinLinkType.LocalFile, `file:///${'foobarbaz/'.repeat(102)}`, []);
	});
});
