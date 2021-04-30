/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/workbench/workbench.web.api';

export function getFileContentBase64(fileUri: URI): Promise<string> {
	return new Promise<string>(async resolve => {
		let response = await fetch(fileUri.toString());
		let blob = await response.blob();

		let file = new File([blob], fileUri.fsPath);
		let reader = new FileReader();
		// Read file content on file loaded event
		reader.onload = function (event) {
			resolve(event.target.result.toString());
		};
		// Convert data to base64
		reader.readAsDataURL(file);
	});
}

export function getFileMimeType(fileUri: URI): Promise<string> {
	return new Promise<string>(async resolve => {
		let response = await fetch(fileUri.toString());
		let blob = await response.blob();
		return resolve(blob.type);
	});
}
