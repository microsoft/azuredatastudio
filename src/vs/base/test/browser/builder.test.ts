/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import { Build, Builder, MultiBuilder, $, bindElement, withElement, setPropertyOnElement, getPropertyFromElement } from 'vs/base/browser/builder';
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

let withBuilder = function (builder: Builder, offdom: boolean) {
	if (builder instanceof MultiBuilder) {
		return new MultiBuilder(builder);
	}

	return new Builder(builder.getHTMLElement(), offdom);
};

function select(builder: Builder, selector: string, offdom?: boolean): MultiBuilder {
	let elements = builder.getHTMLElement().querySelectorAll(selector);

	let builders: Builder[] = [];
	for (let i = 0; i < elements.length; i++) {
		builders.push(withElement(<HTMLElement>elements.item(i), offdom));
	}

	return new MultiBuilder(builders);
}

suite('Builder', () => {
	test('Binding', function () {
	});
});
