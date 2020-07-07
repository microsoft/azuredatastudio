/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This code is originally from https://github.com/DonJayamanne/bowerVSCode
// License: https://github.com/DonJayamanne/bowerVSCode/blob/master/LICENSE

import Prompt from './prompt';
import ConfirmPrompt from './confirm';

export default class PromptFactory {

	public static createPrompt(question: any): Prompt {
		switch (question.type) {
			case 'confirm':
				return new ConfirmPrompt(question);
			default:
				throw new Error(`Could not find a prompt for question type ${question.type}`);
		}
	}
}
