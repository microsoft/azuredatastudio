/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

var updateGrammar = require('vscode-grammar-updater');

updateGrammar.update('textmate/git.tmbundle', 'Syntaxes/Git%20Commit%20Message.tmLanguage', './syntaxes/git-commit.tmLanguage.json');
updateGrammar.update('textmate/git.tmbundle', 'Syntaxes/Git%20Rebase%20Message.tmLanguage', './syntaxes/git-rebase.tmLanguage.json');
