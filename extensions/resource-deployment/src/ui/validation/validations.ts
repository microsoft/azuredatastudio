/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { EOL } from 'os';
import { throwUnless } from '../../common/utils';
import * as loc from '../../localizedConstants';
import { InputComponent } from '../modelViewUtils';
import { RadioGroupLoadingComponentBuilder } from '../radioGroupLoadingComponentBuilder';

export interface ValidationResult {
	valid: boolean;
	message?: string;
}

export type Validator = () => Promise<ValidationResult>;
export type VariableValueGetter = (variable: string) => Promise<string | number | undefined | null>;
export type ValueGetter = () => Promise<string | number | undefined | null>;

export const enum ValidationType {
	IsInteger = 'is_integer',
	Regex = 'regex_match',
	LessThanOrEqualsTo = '<=',
	GreaterThanOrEqualsTo = '>='
}

export type IValidation = IRegexValidation | IIntegerValidation | IComparisonValidation;

export interface IValidationBase {
	readonly type: ValidationType,
	readonly description: string,
	getValidator?(): Validator
}

export type IIntegerValidation = IValidationBase;

export interface IRegexValidation extends IValidationBase {
	readonly regex: string | RegExp
}

export interface IComparisonValidation extends IValidationBase {
	readonly target: string
}

export abstract class Validation implements IValidationBase {
	private _type: ValidationType;
	private _description: string;

	get type(): ValidationType {
		return this._type;
	}

	get description(): string {
		return this._description;
	}

	// gets the validator for this validation object
	abstract getValidator(): Validator;

	protected getValue(): Promise<string | number | undefined | null> {
		return this._valueGetter();
	}

	protected getVariableValue(variable: string): Promise<string | number | undefined | null> {
		return this._variableValueGetter!(variable);
	}

	constructor(validation: IValidation, protected _valueGetter: ValueGetter, protected _variableValueGetter?: VariableValueGetter) {
		this._type = validation.type;
		this._description = validation.description;
	}
}

export class IntegerValidation extends Validation implements IIntegerValidation {
	constructor(validation: IValidation, valueGetter: ValueGetter) {
		super(validation, valueGetter);
	}

	private async isInteger(): Promise<boolean> {
		const value = await this.getValue();
		return (typeof value === 'string') ? Number.isInteger(parseFloat(value)) : Number.isInteger(value);
	}

	getValidator(): Validator {
		return async () => Promise.resolve({
			valid: await this.isInteger(),
			message: this.description
		});
	}
}

export class RegexValidation extends Validation implements IRegexValidation {
	private _regex: RegExp;

	get regex(): RegExp {
		return this._regex;
	}

	constructor(validation: IRegexValidation, valueGetter: ValueGetter) {
		super(validation, valueGetter);
		throwUnless(validation.regex !== undefined);
		this._regex = (typeof validation.regex === 'string') ? new RegExp(validation.regex) : validation.regex;
	}

	getValidator(): Validator {
		return async () => Promise.resolve({
			valid: this.regex.test((await this.getValue())?.toString()!),
			message: this.description
		});
	}
}

export abstract class Comparison extends Validation implements IComparisonValidation {
	private _target: string;

	get target(): string {
		return this._target;
	}

	constructor(validation: IComparisonValidation, valueGetter: ValueGetter, variableValueGetter: VariableValueGetter) {
		super(validation, valueGetter, variableValueGetter);
		throwUnless(validation.target !== undefined);
		this._target = validation.target;
	}

	abstract isComparisonSuccessful(): Promise<boolean>;
	getValidator(): Validator {
		return async () => Promise.resolve({
			valid: await this.isComparisonSuccessful(),
			message: this.description
		});
	}
}

export class LessThanOrEqualsValidation extends Comparison {
	async isComparisonSuccessful() {
		return (await this.getValue())! <= ((await this.getVariableValue(this.target))!);
	}
}

export class GreaterThanOrEqualsValidation extends Comparison {
	async isComparisonSuccessful() {
		return (await this.getValue())! >= ((await this.getVariableValue(this.target))!);
	}
}


/**
 *	removes validation message corresponding to this validator from the @see dialogMessage string.
 *
 * @param dialogMessage
 * @param message
*/
export function removeValidationMessage(dialogMessage: azdata.window.DialogMessage, message: string): azdata.window.DialogMessage {
	if (dialogMessage === undefined) {
		return dialogMessage;
	}
	if (dialogMessage.description) {
		return {
			text: dialogMessage.text,
			level: dialogMessage.level,
			description: getStrippedMessage(dialogMessage.description, message)
		};
	} else {
		return {
			text: getStrippedMessage(dialogMessage.text, message),
			level: dialogMessage.level,
			description: dialogMessage.description
		};
	}
}

function getStrippedMessage(originalMessage: string, message: string) {
	if (originalMessage.includes(message)) {
		const messageWithLineBreak = message + '\n';
		const searchText = originalMessage.includes(messageWithLineBreak) ? messageWithLineBreak : message;
		const newMessage = originalMessage.replace(searchText, '');
		return newMessage;
	} else {
		return originalMessage;
	}
}

export function createValidation(validation: IValidation, valueGetter: ValueGetter, variableValueGetter?: VariableValueGetter): Validation {
	switch (validation.type) {
		case ValidationType.Regex: return new RegexValidation(<IRegexValidation>validation, valueGetter);
		case ValidationType.IsInteger: return new IntegerValidation(<IIntegerValidation>validation, valueGetter);
		case ValidationType.LessThanOrEqualsTo: return new LessThanOrEqualsValidation(<IComparisonValidation>validation, valueGetter, variableValueGetter!);
		case ValidationType.GreaterThanOrEqualsTo: return new GreaterThanOrEqualsValidation(<IComparisonValidation>validation, valueGetter, variableValueGetter!);
		default: throw new Error(`unknown validation type:${validation.type}`); //dev error
	}
}

export async function validateAndUpdateValidationMessages(component: InputComponent, container: azdata.window.Dialog | azdata.window.Wizard, validations: IValidation[] = []): Promise<ValidationResult> {
	let dialogMessage = container.message;
	const validationStates = await Promise.all(validations.map(validation => validation.getValidator!()())); // strip off validation messages corresponding to successful validations
	validationStates.filter(state => state.valid).forEach(v => dialogMessage = removeValidationMessage(dialogMessage, v.message!));
	const failedStates = validationStates.filter(state => !state.valid);
	if (failedStates.length > 0) {
		container.message = getDialogMessage([dialogMessage?.description ?? dialogMessage?.text, failedStates[0].message!]);
		if (component instanceof RadioGroupLoadingComponentBuilder) {
			component = component.component();
		}
		await component.updateProperty('validationErrorMessage', failedStates[0].message);
		return failedStates[0];
	} else {
		container.message = dialogMessage;
		return { valid: true };
	}
}

export function getDialogMessage(messages: string[], messageLevel: azdata.window.MessageLevel = azdata.window.MessageLevel.Error): azdata.window.DialogMessage {
	messages = messages.filter(m => !!m);
	return {
		text: messages.length === 1
			? messages[0]
			: loc.multipleValidationErrors,
		description: messages.length === 1 ? undefined : messages.join(EOL),
		level: messageLevel,
	};
}
