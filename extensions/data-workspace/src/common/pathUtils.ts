/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IProjectNameValidation } from 'dataworkspace';
import { isValidBasename, isValidBasenameErrorMessage, isValidFilenameCharacter, sanitizeStringForFilename } from './pathUtilsHelper';

export class PathUtils implements IProjectNameValidation {
	isValidFilenameCharacter(c: string): boolean {
		return isValidFilenameCharacter(c);
	}
	sanitizeStringForFilename(s: string): string {
		return sanitizeStringForFilename(s);
	}
	isValidBasename(name: string | null | undefined): boolean {
		return isValidBasename(name);
	}
	isValidBasenameErrorMessage(name: string | null | undefined): string {
		return isValidBasenameErrorMessage(name);
	}

}
