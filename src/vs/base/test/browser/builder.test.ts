/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import { Build, Builder, MultiBuilder, Binding, Dimension, Position, Box, $ } from 'vs/base/browser/builder';
import * as Types from 'vs/base/common/types';
import * as DomUtils from 'vs/base/browser/dom';
import { TPromise } from 'vs/base/common/winjs.base';
import { IDisposable } from 'vs/base/common/lifecycle';

let withElementsBySelector = function (selector: string, offdom: boolean = false) {
	let elements = window.document.querySelectorAll(selector);

	let builders = [];
	for (let i = 0; i < elements.length; i++) {
		builders.push(new Builder(<HTMLElement>elements.item(i), offdom));
	}

	return new MultiBuilder(builders);
};

let withBuilder = function (builder, offdom) {
	if (builder instanceof MultiBuilder) {
		return new MultiBuilder(builder);
	}

	return new Builder(builder.getHTMLElement(), offdom);
};

suite('Builder', () => {
	let fixture: HTMLElement;
	let fixtureId = 'builder-fixture';

	setup(() => {
		fixture = document.createElement('div');
		fixture.id = fixtureId;
		document.body.appendChild(fixture);
	});

	teardown(() => {
		document.body.removeChild(fixture);
	});

	test('Dimension.substract()', function () {
		// let d1 = new Dimension(200, 100);
		// let d2 = new Box(10, 20, 30, 40);

		// assert.deepEqual(d1.substract(d2), new Dimension(140, 60));
	});
});