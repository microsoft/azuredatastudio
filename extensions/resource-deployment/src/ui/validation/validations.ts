/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { isUndefinedOrEmpty, throwUnless } from '../../common/utils';
import { InputValueType } from '../modelViewUtils';

export interface ValidationResult {
	valid: boolean;
	message?: string;
}

export type Validator = () => Promise<ValidationResult>;


export type OnValidation = (isValid: boolean) => Promise<void>;
export type ValueGetter = () => Promise<InputValueType>;
export type TargetValueGetter = (variable: string) => Promise<InputValueType>;
export type OnTargetValidityChangedGetter = (variable: string) => vscode.Event<boolean>;

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
	protected get onValidation(): OnValidation {
		return this._onValidation;
	}
	// gets the validation result for this validation object
	abstract validate(): Promise<ValidationResult>;

	protected getValue(): Promise<InputValueType> {
		return this._valueGetter();
	}

	protected getTargetValue(variable: string): Promise<InputValueType> {
		return this._targetValueGetter!(variable);
	}

	constructor(validation: ValidationInfo, protected _onValidation: OnValidation, protected _valueGetter: ValueGetter, protected _targetValueGetter?: TargetValueGetter, protected _onTargetValidityChangedGetter?: OnTargetValidityChangedGetter, protected _onNewDisposableCreated?: (disposable: vscode.Disposable) => void) {
		this._description = validation.description;
	}

}

export class IntegerValidation extends Validation {
	constructor(validation: IntegerValidationInfo, onValidation: OnValidation, valueGetter: ValueGetter) {
		super(validation, onValidation, valueGetter);
	}

	private async isIntegerOrEmptyOrUndefined(): Promise<boolean> {
		const value = await this.getValue();
		return (isUndefinedOrEmpty(value))
			? true
			: (typeof value === 'string')
				? Number.isInteger(parseFloat(value))
				: Number.isInteger(value);
	}

	async validate(): Promise<ValidationResult> {
		const isValid = await this.isIntegerOrEmptyOrUndefined();
		await this.onValidation(isValid);
		return {
			valid: isValid,
			message: isValid ? undefined : this.description
		};
	}
}

export class RegexValidation extends Validation {
	private _regex: RegExp;

	get regex(): RegExp {
		return this._regex;
	}

	constructor(validation: RegexValidationInfo, validationMessageUpdater: OnValidation, valueGetter: ValueGetter) {
		super(validation, validationMessageUpdater, valueGetter);
		throwUnless(validation.regex !== undefined);
		this._regex = (typeof validation.regex === 'string') ? new RegExp(validation.regex) : validation.regex;
	}

	async validate(): Promise<ValidationResult> {
		const value = (await this.getValue())?.toString();
		const isValid = isUndefinedOrEmpty(value) ? true : this.regex.test(value!);
		await this.onValidation(isValid);
		return {
			valid: isValid,
			message: isValid ? undefined : this.description
		};
	}
}

export abstract class Comparison extends Validation {
	protected _target: string; // comparison object requires a target so override the base optional setting.
	protected _ensureOnTargetValidityChangeListenerAdded = false;

	get target(): string {
		return this._target;
	}

	protected onTargetValidityChanged(onTargetValidityChangedAction: (e: boolean) => Promise<void>): void {
		const onValidityChanged = this._onTargetValidityChangedGetter(this.target);
		this._onNewDisposableCreated(onValidityChanged(isValid => onTargetValidityChangedAction(isValid)));
	}

	constructor(validation: ComparisonValidationInfo, onValidation: OnValidation, valueGetter: ValueGetter, targetValueGetter: TargetValueGetter, protected _onTargetValidityChangedGetter: OnTargetValidityChangedGetter, protected _onNewDisposableCreated: (disposable: vscode.Disposable) => void) {
		super(validation, onValidation, valueGetter, targetValueGetter);
		throwUnless(validation.target !== undefined);
		this._target = validation.target;
	}

	private validateOnTargetValidityChange() {
		if (!this._ensureOnTargetValidityChangeListenerAdded) {
			this._ensureOnTargetValidityChangeListenerAdded = true;
			this.onTargetValidityChanged(async (isTargetValid: boolean) => {
				if (isTargetValid) { // if target is valid
					await this.validate();
				}
			});
		}
	}

	abstract isComparisonSuccessful(): Promise<boolean>;
	async validate(): Promise<ValidationResult> {
		this.validateOnTargetValidityChange();
		const isValid = await this.isComparisonSuccessful();
		await this.onValidation(isValid);
		return {
			valid: isValid,
			message: isValid ? undefined : this.description
		};
	}
}

export class LessThanOrEqualsValidation extends Comparison {
	async isComparisonSuccessful() {
		const value = (await this.getValue());
		const targetValue = (await this.getTargetValue(this.target));
		return (isUndefinedOrEmpty(value) || isUndefinedOrEmpty(targetValue)) ? true : value! <= targetValue!;
	}
}

export class GreaterThanOrEqualsValidation extends Comparison {
	async isComparisonSuccessful() {
		const value = (await this.getValue());
		const targetValue = (await this.getTargetValue(this.target));
		return (isUndefinedOrEmpty(value) || isUndefinedOrEmpty(targetValue)) ? true : value! >= targetValue!;
	}
}

export function createValidation(validation: ValidationInfo, onValidation: OnValidation, valueGetter: ValueGetter, targetValueGetter?: TargetValueGetter, onTargetValidityChangedGetter?: OnTargetValidityChangedGetter, onDisposableCreated?: (disposable: vscode.Disposable) => void): Validation {
	switch (validation.type) {
		case ValidationType.Regex: return new RegexValidation(<RegexValidationInfo>validation, onValidation, valueGetter);
		case ValidationType.IsInteger: return new IntegerValidation(<IntegerValidationInfo>validation, onValidation, valueGetter);
		case ValidationType.LessThanOrEqualsTo: return new LessThanOrEqualsValidation(<ComparisonValidationInfo>validation, onValidation, valueGetter, targetValueGetter!, onTargetValidityChangedGetter!, onDisposableCreated!);
		case ValidationType.GreaterThanOrEqualsTo: return new GreaterThanOrEqualsValidation(<ComparisonValidationInfo>validation, onValidation, valueGetter, targetValueGetter!, onTargetValidityChangedGetter!, onDisposableCreated!);
		default: throw new Error(`unknown validation type:${validation.type}`); //dev error
	}
}

export async function validateInputBoxComponent(component: azdata.InputBoxComponent, validations: Validation[] = []): Promise<boolean> {
	for (const validation of validations) {
		const result = await validation.validate();
		if (!result.valid) {
			return false; //bail out on first failure, remaining validations are processed after this one has been fixed by the user.
		}
	}
	return true;
}
