/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ParsedArgs } from 'vs/platform/environment/common/environment';

export interface ICommandLineProcessing {
	_serviceBrand: any;
	/**
	* Interprets the various Azure Data Studio-specific command line switches and
	* performs the requisite tasks such as connecting to a server
	*/
	processCommandLine(args: ParsedArgs): Promise<void>;
}

export const ICommandLineProcessing = createDecorator<ICommandLineProcessing>('commandLineService');