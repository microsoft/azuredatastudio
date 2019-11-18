/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class QuestionTypes {
	public static get input(): string { return 'input'; }
	public static get password(): string { return 'password'; }
	public static get confirm(): string { return 'confirm'; }
}

// Question interface to clarify how to use the prompt feature
// based on Bower Question format: https://github.com/bower/bower/blob/89069784bb46bfd6639b4a75e98a0d7399a8c2cb/packages/bower-logger/README.md
export interface IQuestion {
	// Type of question (see QuestionTypes)
	type: string;
	// Name of the question for disambiguation
	name: string;
	// Message to display to the user
	message: string;
	// Optional placeHolder to give more detailed information to the user
	placeHolder?: any;
	// Optional default value - this will be used instead of placeHolder
	default?: any;
	// optional set of choices to be used. Can be QuickPickItems or a simple name-value pair
	choices?: Array<vscode.QuickPickItem | INameValueChoice>;
	// Optional validation function that returns an error string if validation fails
	validate?: (value: any) => string;
	// Optional pre-prompt function. Takes in set of answers so far, and returns true if prompt should occur
	shouldPrompt?: (answers: { [id: string]: any }) => boolean;
	// Optional action to take on the question being answered
	onAnswered?: (value: any) => void;
	// Optional set of options to support matching choices.
	matchOptions?: vscode.QuickPickOptions;
}

// Pair used to display simple choices to the user
interface INameValueChoice {
	name: string;
	value: any;
}

export interface IPrompter {
	promptSingle<T>(question: IQuestion, ignoreFocusOut?: boolean): Promise<T>;
	/**
	 * Prompts for multiple questions
	 *
	 * @returns Map of question IDs to results, or undefined if
	 * the user canceled the question session
	 */
	prompt(questions: IQuestion[], ignoreFocusOut?: boolean): Promise<{ [questionId: string]: any }>;
}
