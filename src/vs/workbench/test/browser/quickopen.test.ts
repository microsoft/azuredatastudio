/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'vs/workbench/browser/parts/editor/editor.contribution'; // make sure to load all contributed editor things into tests
import { Event } from 'vs/base/common/event';
import { IQuickOpenService } from 'vs/platform/quickOpen/common/quickOpen';
import { Registry } from 'vs/platform/registry/common/platform';
import { QuickOpenHandlerDescriptor, IQuickOpenRegistry, Extensions as QuickOpenExtensions, QuickOpenAction, QuickOpenHandler } from 'vs/workbench/browser/quickopen';

export class TestQuickOpenService implements IQuickOpenService {
	public _serviceBrand: undefined;

	private callback?: (prefix?: string) => void;

	constructor(callback?: (prefix?: string) => void) {
		this.callback = callback;
	}

	accept(): void {
	}

	focus(): void {
	}

	close(): void {
	}

	show(prefix?: string, options?: any): Promise<void> {
		if (this.callback) {
			this.callback(prefix);
		}

		return Promise.resolve();
	}

	get onShow(): Event<void> {
		return null!;
	}

	get onHide(): Event<void> {
		return null!;
	}

	public dispose() { }
	public navigate(): void { }
}

suite('QuickOpen', () => {

	class TestHandler extends QuickOpenHandler { }

	test('QuickOpen Handler and Registry', () => {
		let registry = (Registry.as<IQuickOpenRegistry>(QuickOpenExtensions.Quickopen));
		let handler = QuickOpenHandlerDescriptor.create(
			TestHandler,
			'testhandler',
			',',
			'Handler',
			null!
		);

		registry.registerQuickOpenHandler(handler);

		assert(registry.getQuickOpenHandler(',') === handler);

		let handlers = registry.getQuickOpenHandlers();
		assert(handlers.some((handler: QuickOpenHandlerDescriptor) => handler.prefix === ','));
	});

	test('QuickOpen Action', () => {
		let defaultAction = new QuickOpenAction('id', 'label', (undefined)!, new TestQuickOpenService(prefix => assert(!prefix)));
		let prefixAction = new QuickOpenAction('id', 'label', ',', new TestQuickOpenService(prefix => assert(!!prefix)));

		defaultAction.run();
		prefixAction.run();
	});
});
