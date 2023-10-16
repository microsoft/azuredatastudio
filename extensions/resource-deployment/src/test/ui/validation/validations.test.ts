/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import 'mocha';
import { InputValueType } from 'resource-deployment';
import * as should from 'should';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { createValidation, GreaterThanOrEqualsValidation, IntegerValidation, LessThanOrEqualsValidation, RegexValidation, validateInputBoxComponent, Validation, ValidationType } from '../../../ui/validation/validations';

const inputBox = <azdata.InputBoxComponent>{
	validationErrorMessage: ''
};

const testValidations = [
	{
		type: ValidationType.IsInteger,
		description: 'field was not an integer'
	},
	{
		type: ValidationType.Regex,
		description: 'field must contain only alphabetic characters',
		regex: '^[a-z]+$'
	},
	{
		type: ValidationType.LessThanOrEqualsTo,
		description: 'field value must be <= field2\'s value',
		target: 'field2'
	},
	{
		type: ValidationType.GreaterThanOrEqualsTo,
		description: 'field value must be >= field1\'s value',
		target: 'field1'
	}
];
let onValidityChangedEmitter: vscode.EventEmitter<boolean>;

describe('Validation', () => {
	beforeEach('validation setup', () => {
		sinon.restore(); //cleanup all previously defined sinon mocks
		onValidityChangedEmitter = new vscode.EventEmitter<boolean>(); // recreate for every test so that any previous subscriptions on the event are cleared out.
	});
	describe('createValidation and validate input Box', () => {
		testValidations.forEach(testObj => {
			it(`validationType: ${testObj.type}`, async () => {
				const validation = createValidation(
					testObj,
					async () => undefined,
					async (_varName: string) => undefined,
					(_variableName) => onValidityChangedEmitter.event,
					(_disposable: vscode.Disposable) => { }
				);
				switch (testObj.type) {
					case ValidationType.IsInteger: should(validation).be.instanceOf(IntegerValidation); break;
					case ValidationType.Regex: should(validation).be.instanceOf(RegexValidation); break;
					case ValidationType.LessThanOrEqualsTo: should(validation).be.instanceOf(LessThanOrEqualsValidation); break;
					case ValidationType.GreaterThanOrEqualsTo: should(validation).be.instanceOf(GreaterThanOrEqualsValidation); break;
				}
				should(await validateInputBoxComponent(inputBox, [validation])).be.true(`Call to validate should be true`); // undefined and '' values are valid so validation should return true. This allows for fields that are not required
			});
		});
	});

	describe('IntegerValidation', () => {
		// all the below test values are arbitrary representative values or sentinel values for integer validation
		[
			{ value: '342520596781', expected: true },
			{ value: 342520596781, expected: true },
			{ value: '3.14', expected: false },
			{ value: 3.14, expected: false },
			{ value: '3.14e2', expected: true },
			{ value: 3.14e2, expected: true },
			{ value: undefined, expected: true },
			{ value: '', expected: true },
			{ value: NaN, expected: false },
		].forEach((testObj) => {
			const displayTestValue = getDisplayString(testObj.value);
			it(`testValue:${displayTestValue}`, async () => {
				const validationDescription = `value: ${displayTestValue} was not an integer`;
				const validation = new IntegerValidation(
					{ type: ValidationType.IsInteger, description: validationDescription },
					async () => testObj.value
				);
				await testValidation(validation, testObj, validationDescription);
			});
		});
	});

	describe('RegexValidation', () => {
		const testRegex = '^[0-9]+$';
		// tests
		[
			{ value: '3425205616179816', expected: true },
			{ value: 3425205616179816, expected: true },
			{ value: '3.14', expected: false },
			{ value: 3.14, expected: false },
			{ value: '3.14e2', expected: false },
			{ value: 3.14e2, expected: true }, // value of 3.14e2 literal is 342 which in string matches the testRegex
			{ value: 'arbitraryString', expected: false },
			{ value: undefined, expected: true },
			{ value: '', expected: true },
		].forEach(testOb => {
			const displayTestValue = getDisplayString(testOb.value);
			it(`regex: /${testRegex}/, testValue:${displayTestValue}, expect result: ${testOb.expected}`, async () => {
				const validationDescription = `value:${displayTestValue} did not match the regex:/${testRegex}/`;
				const validation = new RegexValidation(
					{ type: ValidationType.IsInteger, description: validationDescription, regex: testRegex },
					async () => testOb.value
				);
				await testValidation(validation, testOb, validationDescription);
			});
		});
	});

	describe('LessThanOrEqualsValidation', () => {
		const targetVariableName = 'comparisonTarget';
		// tests - when operands are mix of string and number then number comparison is performed
		[
			// integer values
			{ value: '342', targetValue: '42', expected: true },

			{ value: 342, targetValue: '42', expected: false },
			{ value: '342', targetValue: 42, expected: false },

			{ value: 42, targetValue: '342', expected: true },
			{ value: '42', targetValue: 342, expected: true },
			{ value: 42, targetValue: '42', expected: true },

			{ value: 342, targetValue: 42, expected: false },

			// floating pt values
			{ value: '342.15e-1', targetValue: '42.15e-1', expected: true },
			{ value: 342.15e-1, targetValue: '42.15e-1', expected: false },
			{ value: '342.15e-1', targetValue: 42.15e-1, expected: false },
			{ value: 342.15e-1, targetValue: 42.15e-1, expected: false },

			// equal values
			{ value: '342.15', targetValue: '342.15', expected: true },
			{ value: 342.15, targetValue: '342.15', expected: true },
			{ value: '342.15', targetValue: 342.15, expected: true },
			{ value: 342.15, targetValue: 342.15, expected: true },


			// undefined values - if one operand is undefined result is always true - this is to allow fields that are not a required value to be valid.
			{ value: undefined, targetValue: '42', expected: true },
			{ value: undefined, targetValue: 42, expected: true },
			{ value: '42', targetValue: undefined, expected: true },
			{ value: 42, targetValue: undefined, expected: true },
			{ value: undefined, targetValue: '', expected: true },
			{ value: undefined, targetValue: undefined, expected: true },

			// '' values - if one operand is '' result is always true - this is to allow fields that are not a required value to be valid.
			{ value: '', targetValue: '42', expected: true },
			{ value: '', targetValue: 42, expected: true },
			{ value: '42', targetValue: '', expected: true },
			{ value: 42, targetValue: '', expected: true },
			{ value: '', targetValue: undefined, expected: true },
			{ value: '', targetValue: '', expected: true },
		].forEach(testObj => {
			const displayTestValue = getDisplayString(testObj.value);
			const displayTargetValue = getDisplayString(testObj.targetValue);
			it(`testValue:${displayTestValue}, targetValue:${displayTargetValue}`, async () => {
				const validationDescription = `${displayTestValue} did not test as <= ${displayTargetValue}`;
				const validation = new LessThanOrEqualsValidation(
					{ type: ValidationType.IsInteger, description: validationDescription, target: targetVariableName },
					async () => testObj.value,
					async (_variableName: string) => testObj.targetValue,
					(_variableName) => onValidityChangedEmitter.event,
					(_disposable) => { } // do nothing with the disposable for the test.
				);
				await testValidation(validation, testObj, validationDescription);
			});
		});
	});

	describe('GreaterThanOrEqualsValidation', () => {
		const targetVariableName = 'comparisonTarget';
		// tests - when operands are mix of string and number then number comparison is performed
		[
			// integer values
			{ value: '342', targetValue: '42', expected: false },
			{ value: 342, targetValue: '42', expected: true },
			{ value: '342', targetValue: 42, expected: true },
			{ value: 342, targetValue: 42, expected: true },

			// floating pt values
			{ value: '342.15e-1', targetValue: '42.15e-1', expected: false },
			{ value: 342.15e-1, targetValue: '42.15e-1', expected: true },
			{ value: '342.15e-1', targetValue: 42.15e-1, expected: true },
			{ value: 342.15e-1, targetValue: 42.15e-1, expected: true },

			// equal values
			{ value: '342.15', targetValue: '342.15', expected: true },
			{ value: 342.15, targetValue: '342.15', expected: true },
			{ value: '342.15', targetValue: 342.15, expected: true },
			{ value: 342.15, targetValue: 342.15, expected: true },

			// undefined values - if one operand is undefined result is always false - this is to allow fields that are not a required value to be valid.
			{ value: undefined, targetValue: '42', expected: true },
			{ value: undefined, targetValue: 42, expected: true },
			{ value: '42', targetValue: undefined, expected: true },
			{ value: 42, targetValue: undefined, expected: true },
			{ value: undefined, targetValue: '', expected: true },
			{ value: undefined, targetValue: undefined, expected: true },

			// '' values - if one operand is '' result is always false - this is to allow fields that are not a required value to be valid.
			{ value: '', targetValue: '42', expected: true },
			{ value: '', targetValue: 42, expected: true },
			{ value: '42', targetValue: '', expected: true },
			{ value: 42, targetValue: '', expected: true },
			{ value: '', targetValue: undefined, expected: true },
			{ value: '', targetValue: '', expected: true },
		].forEach(testObj => {
			const displayTestValue = getDisplayString(testObj.value);
			const displayTargetValue = getDisplayString(testObj.targetValue);
			it(`testValue:${displayTestValue}, targetValue:${displayTargetValue}`, async () => {
				const validationDescription = `${displayTestValue} did not test as >= ${displayTargetValue}`;
				const validation = new GreaterThanOrEqualsValidation(
					{ type: ValidationType.IsInteger, description: validationDescription, target: targetVariableName },
					async () => testObj.value,
					async (_variableName: string) => testObj.targetValue,
					(_variableName) => onValidityChangedEmitter.event,
					(_disposable) => { } // do nothing with the disposable for the test
				);
				await testValidation(validation, testObj, validationDescription);
			});
		});
	});
});

interface TestObject {
	value: InputValueType;
	targetValue?: InputValueType;
	expected: boolean;
}

async function testValidation(validation: Validation, test: TestObject, validationDescription: string) {
	const validationResult = await validation.validate();
	should(validationResult.valid).be.equal(test.expected, validationDescription);
	validationResult.valid
		? should(validationResult.message).be.undefined()
		: should(validationResult.message).be.equal(validationDescription);
}

function getDisplayString(value: InputValueType) {
	return typeof value === 'string' ? `"${value}"` : value;
}

