import * as assert from 'assert';

import { escapeLabel, escapeUrl, ILinkCalloutDialogOptions, LinkCalloutDialog } from 'sql/workbench/contrib/notebook/browser/calloutDialog/linkCalloutDialog';
import { TestLayoutService } from 'vs/workbench/test/browser/workbenchTestServices';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { Deferred } from 'sql/base/common/promise';

suite('Link Callout Dialog', function (): void {
	let layoutService: ILayoutService;
	let themeService: IThemeService;
	let telemetryService: IAdsTelemetryService;
	let contextKeyService: IContextKeyService;

	setup(() => {
		layoutService = new TestLayoutService();
		themeService = new TestThemeService();
		telemetryService = new NullAdsTelemetryService();
		contextKeyService = new MockContextKeyService();
	});

	test('Should return empty markdown on cancel', async function (): Promise<void> {
		let linkCalloutDialog = new LinkCalloutDialog('Title', undefined, 'defaultLabel',
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

		assert.equal(result.insertEscapedLinkLabel, 'defaultLabel', 'Label not returned correctly');
		assert.equal(result.insertEscapedLinkUrl, undefined, 'URL not returned correctly');
		assert.equal(result.insertMarkdown, '', 'Markdown not returned correctly');
	});

	test('Should return expected values on insert', async function (): Promise<void> {
		const defaultLabel = 'defaultLabel';
		const sampleUrl = 'https://www.aka.ms/azuredatastudio';
		let linkCalloutDialog = new LinkCalloutDialog('Title', undefined, defaultLabel,
			undefined, themeService, layoutService, telemetryService, contextKeyService, undefined, undefined, undefined);
		linkCalloutDialog.render();

		let deferred = new Deferred<ILinkCalloutDialogOptions>();
		// When I first open the callout dialog
		linkCalloutDialog.open().then(value => {
			deferred.resolve(value);
		});

		linkCalloutDialog.setUrl(sampleUrl);

		// And insert the dialog
		linkCalloutDialog.insert();
		let result = await deferred.promise;

		assert.equal(result.insertEscapedLinkLabel, defaultLabel, 'Label not returned correctly');
		assert.equal(result.insertEscapedLinkUrl, sampleUrl, 'URL not returned correctly');
		assert.equal(result.insertMarkdown, `[${defaultLabel}](${sampleUrl})`, 'Markdown not returned correctly');
	});

	test('Label escape', function (): void {
		assert.equal(escapeLabel('TestLabel'), 'TestLabel', 'Basic escape label test failed');
		assert.equal(escapeLabel('Test[]Label'), 'Test\[\]Label', 'Label test square brackets failed');
		assert.equal(escapeLabel('<>&[]'), '&lt;&gt;&amp;\[\]', 'Label test known escaped characters failed');
		assert.equal(escapeLabel('<>&[]()'), '&lt;&gt;&amp;\[\]()', 'Label test all escaped characters failed');
	});

	test('URL escape', function (): void {
		assert.equal(escapeUrl('TestURL'), 'TestURL', 'Basic escape URL test failed');
		assert.equal(escapeUrl('Test()URL'), 'Test%28%29URL', 'URL test square brackets failed');
		assert.equal(escapeUrl('<>&()'), '&lt;&gt;&amp;%28%29', 'URL test known escaped characters failed');
		assert.equal(escapeUrl('<>&()[]'), '&lt;&gt;&amp;%28%29[]', 'URL test all escaped characters failed');
	});
});
