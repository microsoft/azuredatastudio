/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type Validator = () => { valid: boolean, message: string };
export type VariableValueGetter = (variable: string) => string | number | undefined;
export type ValueGetter = () => string | number | undefined;

export const enum ValidationType {
	IsInteger = 'is_integer',
	Regex = 'regex',
	LessThanOrEquals = '<=',
	GreaterThanOrEquals = '>='
}

export type IValidation = IRegexValidation | IIsIntegerValidation | IComparisonValidation;

export interface IValidationBase {
	readonly type: ValidationType,
	readonly description: string,
}

export type IIsIntegerValidation = IValidationBase;

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

	protected getValue(): string | number | undefined {
		return this._valueGetter();
	}

	public setValueGetter(valueGetter: ValueGetter): void {
		this._valueGetter = valueGetter;
	}
	protected getVariableValue(variable: string): string | number | undefined | Promise<string | number | undefined> {
		return this._variableValueGetter(variable);
	}

	constructor(validation: IValidation, protected _valueGetter: ValueGetter, protected _variableValueGetter: VariableValueGetter) {
		this._type = validation.type;
		this._description = validation.description;
	}
}

export class IsIntegerValidation extends Validation implements IIsIntegerValidation {
	constructor(validation: IValidation, valueGetter: ValueGetter, variableValueGetter: VariableValueGetter) {
		super(validation, valueGetter, variableValueGetter);
	}

	private isInteger(): boolean {
		const value = this.getValue();
		return (typeof value === 'number') ? Number.isInteger(value) : /^[-+]?\d+$/.test(value);
	}

	getValidator(): Validator {
		return () => {
			return {
				valid: this.isInteger(),
				message: this.description
			};
		};
	}
}

export class RegexValidation extends Validation implements IRegexValidation {
	private _regex: RegExp;

	get regex(): RegExp {
		return this._regex;
	}

	constructor(validation: IRegexValidation, valueGetter: ValueGetter, variableValueGetter: VariableValueGetter) {
		super(validation, valueGetter, variableValueGetter);
		this._regex = (typeof validation.regex === 'string') ? new RegExp(validation.regex) : validation.regex;
	}

	getValidator(): Validator {
		return () => {
			return {
				valid: this.regex.test(this.getValue().toString()),
				message: this.description
			};
		};
	}
}

export abstract class Comparison extends Validation implements IComparisonValidation {
	private _target: string;

	get target(): string {
		return this._target;
	}

	constructor(validation: IComparisonValidation, valueGetter: ValueGetter, variableValueGetter: VariableValueGetter) {
		super(validation, valueGetter, variableValueGetter);
		this._target = validation.target;
	}

	abstract isComparisonSuccessful(): boolean;
	getValidator(): Validator {
		return () => {
			return {
				valid: this.isComparisonSuccessful(),
				message: this.description
			};
		};
	}
}

export class LessThanOrEqualsValidation extends Comparison {
	isComparisonSuccessful() {
		return this.getValue() <= this.getVariableValue(this.target) ?? this.target; //if target is not a variable then compare to target itself
	}
}

export class GreaterThanOrEqualsValidation extends Comparison {
	isComparisonSuccessful() {
		return this.getValue() >= this.getVariableValue(this.target) ?? this.target; //if target is not a variable then compare to target itself
	}
}


/**
 *	removes validation message corresponding to this validator from the @see postedValidationMessage string.
 *
 * @param postedValidationMessage
 * @param message
 */
export function removeValidationMessage(postedValidationMessage: string, message: string): string {
	if (postedValidationMessage.includes(message)) {
		const messageWithLineBreak = message + '\n';
		const searchText = postedValidationMessage.includes(messageWithLineBreak) ? messageWithLineBreak : message;
		return postedValidationMessage.replace(searchText, '');
	} else {
		return postedValidationMessage;
	}
}

export function createValidation(validation: IValidation, valueGetter: ValueGetter, variableValueGetter: VariableValueGetter) {
	switch (validation.type) {
		case ValidationType.Regex: return new RegexValidation(<IRegexValidation>validation, valueGetter, variableValueGetter);
		case ValidationType.IsInteger: return new IsIntegerValidation(<IIsIntegerValidation>validation, valueGetter, variableValueGetter);
		case ValidationType.LessThanOrEquals: return new LessThanOrEqualsValidation(<IComparisonValidation>validation, valueGetter, variableValueGetter);
		case ValidationType.GreaterThanOrEquals: return new GreaterThanOrEqualsValidation(<IComparisonValidation>validation, valueGetter, variableValueGetter);
		default: throw new Error(`unknown validation type:${validation.type}`); //dev error
	}
}
