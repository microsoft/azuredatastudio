/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export const enum QuestionTypes {
	input = 'input',
	password = 'password',
	confirm = 'confirm'
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
export interface INameValueChoice {
	name: string;
	value: any;
}

// Generic object that can be used to define a set of questions and handle the result
export interface IQuestionHandler {
	// Set of questions to be answered
	questions: IQuestion[];
	// Optional callback, since questions may handle themselves
	callback?: IPromptCallback;
}

export interface IPrompter {
	promptSingle<T>(question: IQuestion): Promise<T>;
	/**
	 * Prompts for multiple questions
	 *
	 * @returns Map of question IDs to results, or undefined if
	 * the user canceled the question session
	 */
	prompt<T>(questions: IQuestion[]): Promise<{ [questionId: string]: any }>;
}

export interface IPromptCallback {
	(answers: { [id: string]: any }): void;
}
