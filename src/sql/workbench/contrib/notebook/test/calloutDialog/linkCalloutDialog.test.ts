import * as assert from 'assert';

import { ILinkCalloutDialogOptions, LinkCalloutDialog } from 'sql/workbench/contrib/notebook/browser/calloutDialog/linkCalloutDialog';
import { TestLayoutService } from 'vs/workbench/test/browser/workbenchTestServices';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { Deferred } from 'sql/base/common/promise';
import { escapeLabel, escapeUrl, unquoteText } from 'sql/workbench/contrib/notebook/browser/calloutDialog/common/utils';
import { IDialogProperties } from 'sql/workbench/browser/modal/modal';

suite('Link Callout Dialog', function (): void {
	let layoutService: ILayoutService;
	let themeService: IThemeService;
	let telemetryService: IAdsTelemetryService;
	let contextKeyService: IContextKeyService;

	const defaultDialogProperties: IDialogProperties = { xPos: 0, yPos: 0, height: 250, width: 100 };

	setup(() => {
		layoutService = new TestLayoutService();
		themeService = new TestThemeService();
		telemetryService = new NullAdsTelemetryService();
		contextKeyService = new MockContextKeyService();
	});

	test('Should return empty markdown on cancel', async function (): Promise<void> {
		let linkCalloutDialog = new LinkCalloutDialog('Title', 'below', defaultDialogProperties, 'defaultLabel', 'defaultLinkLabel',
			undefined, themeService, layoutService, telemetryService, contextKeyService, undefined, undefined, undefined);
		linkCalloutDialog.render();

		let deferred = new Deferred<ILinkCalloutDialogOptions>();
		// When I first open the callout dialog
		linkCalloutDialog.open().then(value => {
			deferred.resolve(value);
		});
		// And cancel the dialog
		linkCalloutDialog.cancel();
		let result = await deferred.promise;

		assert.strictEqual(result.insertUnescapedLinkLabel, 'defaultLabel', 'Label not returned correctly');
		assert.strictEqual(result.insertUnescapedLinkUrl, undefined, 'URL not returned correctly');
		assert.strictEqual(result.insertEscapedMarkdown, '', 'Markdown not returned correctly');
	});

	test('Should return expected values on insert', async function (): Promise<void> {
		const defaultLabel = 'defaultLabel';
		const sampleUrl = 'https://www.aka.ms/azuredatastudio';
		let linkCalloutDialog = new LinkCalloutDialog('Title', 'below', defaultDialogProperties, defaultLabel, sampleUrl,
			undefined, themeService, layoutService, telemetryService, contextKeyService, undefined, undefined, undefined);
		linkCalloutDialog.render();

		let deferred = new Deferred<ILinkCalloutDialogOptions>();
		// When I first open the callout dialog
		linkCalloutDialog.open().then(value => {
			deferred.resolve(value);
		});

		linkCalloutDialog.url = sampleUrl;

		// And insert the dialog
		linkCalloutDialog.insert();
		let result = await deferred.promise;
		assert.strictEqual(result.insertUnescapedLinkLabel, defaultLabel, 'Label not returned correctly');
		assert.strictEqual(result.insertUnescapedLinkUrl, sampleUrl, 'URL not returned correctly');
		assert.strictEqual(result.insertEscapedMarkdown, `[${defaultLabel}](${sampleUrl})`, 'Markdown not returned correctly');
	});

	test('Should return expected values on insert when escape necessary', async function (): Promise<void> {
		const defaultLabel = 'default[]Label';
		const sampleUrl = 'https://www.aka.ms/azuredatastudio()';
		let linkCalloutDialog = new LinkCalloutDialog('Title', 'below', defaultDialogProperties, defaultLabel, sampleUrl,
			undefined, themeService, layoutService, telemetryService, contextKeyService, undefined, undefined, undefined);
		linkCalloutDialog.render();

		let deferred = new Deferred<ILinkCalloutDialogOptions>();
		// When I first open the callout dialog
		linkCalloutDialog.open().then(value => {
			deferred.resolve(value);
		});

		linkCalloutDialog.url = sampleUrl;

		// And insert the dialog
		linkCalloutDialog.insert();
		let result = await deferred.promise;
		assert.strictEqual(result.insertUnescapedLinkLabel, defaultLabel, 'Label not returned correctly');
		assert.strictEqual(result.insertUnescapedLinkUrl, sampleUrl, 'URL not returned correctly');
		assert.strictEqual(result.insertEscapedMarkdown, '[default\[\]Label](https://www.aka.ms/azuredatastudio%28%29)', 'Markdown not returned correctly');
	});

	test('Label escape', function (): void {
		assert.strictEqual(escapeLabel('TestLabel'), 'TestLabel', 'Basic escape label test failed');
		assert.strictEqual(escapeLabel('Test[]Label'), 'Test\[\]Label', 'Label test square brackets failed');
		assert.strictEqual(escapeLabel('<>&[]'), '&lt;&gt;&amp;\[\]', 'Label test known escaped characters failed');
		assert.strictEqual(escapeLabel('<>&[]()'), '&lt;&gt;&amp;\[\]()', 'Label test all escaped characters failed');
	});

	test('URL escape', function (): void {
		assert.strictEqual(escapeUrl('TestURL'), 'TestURL', 'Basic escape URL test failed');
		assert.strictEqual(escapeUrl('Test()URL'), 'Test%28%29URL', 'URL test square brackets failed');
		assert.strictEqual(escapeUrl('<>&()'), '&lt;&gt;&amp;%28%29', 'URL test known escaped characters failed');
		assert.strictEqual(escapeUrl('<>&()[]'), '&lt;&gt;&amp;%28%29[]', 'URL test all escaped characters failed');
		assert.strictEqual(escapeUrl('TEST URL'), 'TEST%20URL', 'URL with spaces failed');
		assert.strictEqual(escapeUrl('TEST%20URL'), 'TEST%2520URL', 'URL with %20 failed');
		assert.strictEqual(escapeUrl('TEST %20 URL'), 'TEST%20%2520%20URL', 'URL with %20 and spaces failed');
	});

	test('Unquote text', function (): void {
		assert.strictEqual(unquoteText('TestPath'), 'TestPath');
		assert.strictEqual(unquoteText('\"TestPath\"'), 'TestPath');
		assert.strictEqual(unquoteText('\'TestPath\''), 'TestPath');
		assert.strictEqual(unquoteText('\'TestPath\"'), 'TestPath');
		assert.strictEqual(unquoteText('\"TestPath\''), 'TestPath');
		assert.strictEqual(unquoteText('\"Tes"tPa"th\"'), 'Tes"tPa"th');
		assert.strictEqual(unquoteText('\"TestPath'), '\"TestPath');
		assert.strictEqual(unquoteText('\'TestPath'), '\'TestPath');
		assert.strictEqual(unquoteText('TestPath\"'), 'TestPath\"');
		assert.strictEqual(unquoteText('TestPath\''), 'TestPath\'');
		assert.strictEqual(unquoteText(undefined), undefined);
	});

	test('Should return file link properly', async function (): Promise<void> {
		const defaultLabel = 'defaultLabel';
		const sampleUrl = 'C:/Test/Test.ipynb';
		let linkCalloutDialog = new LinkCalloutDialog('Title', 'below', defaultDialogProperties, defaultLabel, sampleUrl,
			undefined, themeService, layoutService, telemetryService, contextKeyService, undefined, undefined, undefined);
		linkCalloutDialog.render();

		let deferred = new Deferred<ILinkCalloutDialogOptions>();
		// When I first open the callout dialog
		linkCalloutDialog.open().then(value => {
			deferred.resolve(value);
		});
		linkCalloutDialog.url = sampleUrl;

		// And insert the dialog
		linkCalloutDialog.insert();
		let result = await deferred.promise;
		assert.strictEqual(result.insertUnescapedLinkLabel, defaultLabel, 'Label not returned correctly');
		assert.strictEqual(result.insertUnescapedLinkUrl, sampleUrl, 'URL not returned correctly');
		assert.strictEqual(result.insertEscapedMarkdown, `[${defaultLabel}](${sampleUrl})`, 'Markdown not returned correctly');
	});

	test('Should handle quoted URLs properly', async function (): Promise<void> {
		const defaultLabel = 'defaultLabel';
		const unquotedUrl = 'C:/Test/Test.ipynb';
		const quotedUrl = `"${unquotedUrl}"`;
		let linkCalloutDialog = new LinkCalloutDialog('Title', 'below', defaultDialogProperties, defaultLabel, '',
			undefined, themeService, layoutService, telemetryService, contextKeyService, undefined, undefined, undefined);
		linkCalloutDialog.render();

		let deferred = new Deferred<ILinkCalloutDialogOptions>();
		// When I first open the callout dialog
		linkCalloutDialog.open().then(value => {
			deferred.resolve(value);
		});
		linkCalloutDialog.url = quotedUrl;

		// And insert the dialog
		linkCalloutDialog.insert();
		let result = await deferred.promise;
		assert.strictEqual(result.insertUnescapedLinkLabel, defaultLabel, 'Label not returned correctly');
		assert.strictEqual(result.insertUnescapedLinkUrl, unquotedUrl, 'URL not unquoted correctly');
		assert.strictEqual(result.insertEscapedMarkdown, `[${defaultLabel}](${unquotedUrl})`, 'Markdown not unquoted correctly');
	});
});
