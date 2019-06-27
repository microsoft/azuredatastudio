/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DefaultUrlSerializer, UrlSerializer, UrlTree } from '@angular/router';

/**
 * Angular router uses parentheses for custom behavior, however for file system,
 * they are valid in paths. Therefore before and after angular handles url's, we
 * encode and decode the parentheses. Github issue angular/angular#10280, microsoft/carbon#1116
 */
export default class CustomUrlSerializer implements UrlSerializer {
	private _defaultUrlSerializer: DefaultUrlSerializer = new DefaultUrlSerializer();

	parse(url: string): UrlTree {
		// Encode parentheses
		url = url.replace(/\(/g, '%28').replace(/\)/g, '%29');
		// Use the default serializer from here on
		return this._defaultUrlSerializer.parse(url);
	}

	serialize(tree: UrlTree): string {
		// serialize parentheses after angular router
		return this._defaultUrlSerializer.serialize(tree).replace(/%28/g, '(').replace(/%29/g, ')');
	}
}
