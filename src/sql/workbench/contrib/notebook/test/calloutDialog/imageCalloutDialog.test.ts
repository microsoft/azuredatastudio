/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';

import { TestFileDialogService, TestLayoutService, TestPathService } from 'vs/workbench/test/browser/workbenchTestServices';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { Deferred } from 'sql/base/common/promise';
import { IDialogProperties } from 'sql/workbench/browser/modal/modal';
import { IImageCalloutDialogOptions, ImageCalloutDialog } from 'sql/workbench/contrib/notebook/browser/calloutDialog/imageCalloutDialog';
import { IPathService } from 'vs/workbench/services/path/common/pathService';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import * as path from 'vs/base/common/path';

suite('Image Callout Dialog', function (): void {
	let pathService: IPathService;
	let fileDialogService: IFileDialogService;
	let layoutService: ILayoutService;
	let themeService: IThemeService;
	let telemetryService: IAdsTelemetryService;
	let contextKeyService: IContextKeyService;

	const defaultDialogProperties: IDialogProperties = { xPos: 0, yPos: 0, height: 250, width: 100 };

	setup(() => {
		pathService = new TestPathService();
		fileDialogService = new TestFileDialogService(pathService);
		layoutService = new TestLayoutService();
		themeService = new TestThemeService();
		telemetryService = new NullAdsTelemetryService();
		contextKeyService = new MockContextKeyService();
	});

	test('Should return empty markdown on cancel', async function (): Promise<void> {
		let imageCalloutDialog = new ImageCalloutDialog('Title', 'below', defaultDialogProperties, pathService, fileDialogService,
			undefined, themeService, layoutService, telemetryService, contextKeyService, undefined, undefined, undefined);
		imageCalloutDialog.render();

		let deferred = new Deferred<IImageCalloutDialogOptions>();
		// When I first open the callout dialog
		imageCalloutDialog.open().then(value => {
			deferred.resolve(value);
		});
		// And cancel the dialog
		imageCalloutDialog.cancel();
		let result = await deferred.promise;

		assert.strictEqual(result.imagePath, undefined, 'ImagePath must be undefined');
		assert.strictEqual(result.embedImage, undefined, 'EmbedImage must be undefined');
		assert.strictEqual(result.insertEscapedMarkdown, '', 'Markdown not returned correctly');
	});

	test('Should return expected values on insert', async function (): Promise<void> {
		const sampleImageFileUrl = await pathService.fileURI('../resources/extension.png');
		let imageCalloutDialog = new ImageCalloutDialog('Title', 'below', defaultDialogProperties, pathService, fileDialogService,
			undefined, themeService, layoutService, telemetryService, contextKeyService, undefined, undefined, undefined);
		imageCalloutDialog.render();

		let deferred = new Deferred<IImageCalloutDialogOptions>();
		// When I first open the callout dialog
		imageCalloutDialog.open().then(value => {
			deferred.resolve(value);
		});

		imageCalloutDialog.imagePath = sampleImageFileUrl.fsPath;
		// And insert the dialog
		imageCalloutDialog.insert();
		let result = await deferred.promise;
		assert.strictEqual(result.imagePath, sampleImageFileUrl.fsPath, 'ImagePath not returned correctly');
		assert.strictEqual(result.embedImage, false, 'EmbedImage not returned correctly');
		assert.strictEqual(result.insertEscapedMarkdown, `![](${result.imagePath})`, 'Markdown not returned correctly');
	});

	test('Should return expected values on insert when imageName has space', async function (): Promise<void> {
		const sampleImageFileUrl = await pathService.fileURI('../resources/extension 2.png');
		let imageCalloutDialog = new ImageCalloutDialog('Title', 'below', defaultDialogProperties, pathService, fileDialogService,
			undefined, themeService, layoutService, telemetryService, contextKeyService, undefined, undefined, undefined);
		imageCalloutDialog.render();

		let deferred = new Deferred<IImageCalloutDialogOptions>();
		// When I first open the callout dialog
		imageCalloutDialog.open().then(value => {
			deferred.resolve(value);
		});

		imageCalloutDialog.imagePath = sampleImageFileUrl.fsPath;

		// And insert the dialog
		imageCalloutDialog.insert();
		let result = await deferred.promise;
		assert.strictEqual(result.imagePath, sampleImageFileUrl.fsPath, 'imagePath not returned correctly');
		assert.strictEqual(result.embedImage, false, 'embedImage not returned correctly');
		assert.strictEqual(result.insertEscapedMarkdown, `![](${result.imagePath.replace(' ', '&#32;')})`, 'Markdown not returned correctly');
	});

	test('Should return expected values on insert when add as attachment is set', async function (): Promise<void> {
		const sampleImageFileUrl = await pathService.fileURI('../resources/extension.png');
		let imageCalloutDialog = new ImageCalloutDialog('Title', 'below', defaultDialogProperties, pathService, fileDialogService,
			undefined, themeService, layoutService, telemetryService, contextKeyService, undefined, undefined, undefined);
		imageCalloutDialog.render();

		let deferred = new Deferred<IImageCalloutDialogOptions>();
		// When I first open the callout dialog
		imageCalloutDialog.open().then(value => {
			deferred.resolve(value);
		});

		imageCalloutDialog.imagePath = sampleImageFileUrl.fsPath;
		imageCalloutDialog.embedImage = true;
		let imageName = path.basename(sampleImageFileUrl.fsPath);

		// And insert the dialog
		imageCalloutDialog.insert();
		let result = await deferred.promise;
		assert.strictEqual(result.imagePath, sampleImageFileUrl.fsPath, 'imagePath not returned correctly');
		assert.strictEqual(result.embedImage, true, 'embedImage not returned correctly');
		assert.strictEqual(result.insertEscapedMarkdown, `![${imageName}](attachment:${imageName})`, 'Markdown not returned correctly');
	});

	test('Should return expected values on insert when imageName has space and add attachment is set', async function (): Promise<void> {
		const sampleImageFileUrl = await pathService.fileURI('../resources/extension 2.png');
		let imageCalloutDialog = new ImageCalloutDialog('Title', 'below', defaultDialogProperties, pathService, fileDialogService,
			undefined, themeService, layoutService, telemetryService, contextKeyService, undefined, undefined, undefined);
		imageCalloutDialog.render();

		let deferred = new Deferred<IImageCalloutDialogOptions>();
		// When I first open the callout dialog
		imageCalloutDialog.open().then(value => {
			deferred.resolve(value);
		});

		imageCalloutDialog.imagePath = sampleImageFileUrl.fsPath;
		imageCalloutDialog.embedImage = true;
		let imageName = path.basename(sampleImageFileUrl.fsPath);

		// And insert the dialog
		imageCalloutDialog.insert();
		let result = await deferred.promise;
		assert.strictEqual(result.imagePath, sampleImageFileUrl.fsPath, 'imagePath not returned correctly');
		assert.strictEqual(result.embedImage, true, 'embedImage not returned correctly');
		assert.strictEqual(result.insertEscapedMarkdown, `![${imageName}](attachment:${imageName.replace(' ', '')})`, 'Markdown not returned correctly');
	});

});
