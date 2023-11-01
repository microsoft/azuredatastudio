/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { KeyCode } from 'vs/base/common/keyCodes';
import { StandaloneConfigurationService, StandaloneNotificationService, StandaloneCommandService, StandaloneKeybindingService } from 'vs/editor/standalone/browser/standaloneServices';
import { StandaloneCodeEditorService } from 'vs/editor/standalone/browser/standaloneCodeEditorService';
import { StandaloneThemeService } from 'vs/editor/standalone/browser/standaloneThemeService';
import { ContextKeyService } from 'vs/platform/contextkey/browser/contextKeyService';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { IKeyboardEvent } from 'vs/platform/keybinding/common/keybinding';
import { NullLogService } from 'vs/platform/log/common/log';
import { NullTelemetryService } from 'vs/platform/telemetry/common/telemetryUtils';

suite('StandaloneKeybindingService', () => {

	class TestStandaloneKeybindingService extends StandaloneKeybindingService {
		public testDispatch(e: IKeyboardEvent): void {
			super._dispatch(e, null!);
		}
	}

	test('issue microsoft/monaco-editor#167', () => {

		const serviceCollection = new ServiceCollection();
		const instantiationService = new InstantiationService(serviceCollection, true);
		const configurationService = new StandaloneConfigurationService();
		const contextKeyService = new ContextKeyService(configurationService);
		const commandService = new StandaloneCommandService(instantiationService);
		const notificationService = new StandaloneNotificationService();
		const standaloneThemeService = new StandaloneThemeService();
		const codeEditorService = new StandaloneCodeEditorService(contextKeyService, standaloneThemeService);
		const keybindingService = new TestStandaloneKeybindingService(contextKeyService, commandService, NullTelemetryService, notificationService, new NullLogService(), codeEditorService);

		let commandInvoked = false;
		keybindingService.addDynamicKeybinding('testCommand', KeyCode.F9, () => {
			commandInvoked = true;
		}, undefined);

		keybindingService.testDispatch({
			_standardKeyboardEventBrand: true,
			ctrlKey: false,
			shiftKey: false,
			altKey: false,
			metaKey: false,
			altGraphKey: false,
			keyCode: KeyCode.F9,
			code: null!
		});

		assert.ok(commandInvoked, 'command invoked');
	});
});
