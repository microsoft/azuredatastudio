/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { throwUnless } from '../../common/utils';

export interface ValidationResult {
	valid: boolean;
	message?: string;
}

export type Validator = () => Promise<ValidationResult>;
export type ValidationValueType = string | number | undefined;

export type VariableValueGetter = (variable: string) => Promise<ValidationValueType>;
export type ValueGetter = () => Promise<ValidationValueType>;

export const enum ValidationType {
	IsInteger = 'is_integer',
	Regex = 'regex_match',
	LessThanOrEqualsTo = '<=',
	GreaterThanOrEqualsTo = '>='
}

export type ValidationInfo = RegexValidationInfo | IntegerValidationInfo | ComparisonValidationInfo;

export interface ValidationInfoBase {
	readonly type: ValidationType,
	readonly description: string,
}

export type IntegerValidationInfo = ValidationInfoBase;

export interface RegexValidationInfo extends ValidationInfoBase {
	readonly regex: string | RegExp
}

export interface ComparisonValidationInfo extends ValidationInfoBase {
	readonly target: string
}

export abstract class Validation {
	private _description: string;
	protected readonly _target?: string;

	get target(): string | undefined {
		return this._target;
	}
	get description(): string {
		return this._description;
	}

	// gets the validation result for this validation object
	abstract validate(): Promise<ValidationResult>;

	protected getValue(): Promise<ValidationValueType> {
		return this._valueGetter();
	}

	protected getVariableValue(variable: string): Promise<ValidationValueType> {
		return this._variableValueGetter!(variable);
	}

	constructor(validation: ValidationInfo, protected _valueGetter: ValueGetter, protected _variableValueGetter?: VariableValueGetter) {
		this._description = validation.description;
	}
}

export class IntegerValidation extends Validation {
	constructor(validation: IntegerValidationInfo, valueGetter: ValueGetter) {
		super(validation, valueGetter);
	}

	private async isInteger(): Promise<boolean> {
		const value = await this.getValue();
		return (typeof value === 'string') ? Number.isInteger(parseFloat(value)) : Number.isInteger(value);
	}

	async validate(): Promise<ValidationResult> {
		const isValid = await this.isInteger();
		return {
			valid: isValid,
			message: isValid ? undefined: this.description
		};
	}
}

export class RegexValidation extends Validation {
	private _regex: RegExp;

	get regex(): RegExp {
		return this._regex;
	}

	constructor(validation: RegexValidationInfo, valueGetter: ValueGetter) {
		super(validation, valueGetter);
		throwUnless(validation.regex !== undefined);
		this._regex = (typeof validation.regex === 'string') ? new RegExp(validation.regex) : validation.regex;
	}

	async validate(): Promise<ValidationResult> {
		const value = await this.getValue();
		const isValid = value === undefined
			? false
			: this.regex.test(value.toString());
		return {
			valid: isValid,
			message: isValid ? undefined: this.description
		};
	}
}

export abstract class Comparison extends Validation {
	protected _target: string; // comparison object require a target so override the base optional setting.

	get target(): string {
		return this._target;
	}

	constructor(validation: ComparisonValidationInfo, valueGetter: ValueGetter, variableValueGetter: VariableValueGetter) {
		super(validation, valueGetter, variableValueGetter);
		throwUnless(validation.target !== undefined);
		this._target = validation.target;
	}

	abstract isComparisonSuccessful(): Promise<boolean>;
	async validate(): Promise<ValidationResult> {
		const isValid = await this.isComparisonSuccessful();
		return {
			valid: isValid,
			message:  isValid ? undefined: this.description
		};
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

export function createValidation(validation: ValidationInfo, valueGetter: ValueGetter, variableValueGetter?: VariableValueGetter): Validation {
	switch (validation.type) {
		case ValidationType.Regex: return new RegexValidation(<RegexValidationInfo>validation, valueGetter);
		case ValidationType.IsInteger: return new IntegerValidation(<IntegerValidationInfo>validation, valueGetter);
		case ValidationType.LessThanOrEqualsTo: return new LessThanOrEqualsValidation(<ComparisonValidationInfo>validation, valueGetter, variableValueGetter!);
		case ValidationType.GreaterThanOrEqualsTo: return new GreaterThanOrEqualsValidation(<ComparisonValidationInfo>validation, valueGetter, variableValueGetter!);
		default: throw new Error(`unknown validation type:${validation.type}`); //dev error
	}
}

export async function validateInputBoxComponent(component: azdata.InputBoxComponent, validations: Validation[] = []): Promise<boolean> {
	for (const validation of validations) {
		const result = await validation.validate();
		if (!result.valid) {
			component.updateProperty('validationErrorMessage', result.message);
			return false;
		}
	}
	return true;
}
