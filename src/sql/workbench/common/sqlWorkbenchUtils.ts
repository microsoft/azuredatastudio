/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryInput } from 'sql/workbench/parts/query/common/queryInput';

import { URI } from 'vs/base/common/uri';
import { IEditorInput } from 'vs/workbench/common/editor';

export function getEditorUri(input: IEditorInput): string {
	let uri: URI;
	if (input instanceof QueryInput) {
		let queryCast: QueryInput = <QueryInput>input;
		if (queryCast) {
			uri = queryCast.getResource();
		}
	}

	if (uri) {
		return uri.toString();
	}
	return undefined;
}
