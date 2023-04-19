"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var _a;
const experimental_utils_1 = require("@typescript-eslint/experimental-utils");
function isStringLiteral(node) {
    return !!node && node.type === experimental_utils_1.AST_NODE_TYPES.Literal && typeof node.value === 'string';
}
function isDoubleQuoted(node) {
    return node.raw[0] === '"' && node.raw[node.raw.length - 1] === '"';
}
module.exports = new (_a = class NoUnexternalizedStrings {
        constructor() {
            this.meta = {
                messages: {
                    doubleQuoted: 'Only use double-quoted strings for externalized strings.',
                    badKey: 'The key \'{{key}}\' doesn\'t conform to a valid localize identifier.',
                    duplicateKey: 'Duplicate key \'{{key}}\' with different message value.',
                    badMessage: 'Message argument to \'{{message}}\' must be a string literal.'
                }
            };
        }
        create(context) {
            const externalizedStringLiterals = new Map();
            const doubleQuotedStringLiterals = new Set();
            function collectDoubleQuotedStrings(node) {
                if (isStringLiteral(node) && isDoubleQuoted(node)) {
                    doubleQuotedStringLiterals.add(node);
                }
            }
            function visitLocalizeCall(node) {
                // localize(key, message)
                const [keyNode, messageNode] = node.arguments;
                // (1)
                // extract key so that it can be checked later
                let key;
                if (isStringLiteral(keyNode)) {
                    doubleQuotedStringLiterals.delete(keyNode);
                    key = keyNode.value;
                }
                else if (keyNode.type === experimental_utils_1.AST_NODE_TYPES.ObjectExpression) {
                    for (let property of keyNode.properties) {
                        if (property.type === experimental_utils_1.AST_NODE_TYPES.Property && !property.computed) {
                            if (property.key.type === experimental_utils_1.AST_NODE_TYPES.Identifier && property.key.name === 'key') {
                                if (isStringLiteral(property.value)) {
                                    doubleQuotedStringLiterals.delete(property.value);
                                    key = property.value.value;
                                    break;
                                }
                            }
                        }
                    }
                }
                if (typeof key === 'string') {
                    let array = externalizedStringLiterals.get(key);
                    if (!array) {
                        array = [];
                        externalizedStringLiterals.set(key, array);
                    }
                    array.push({ call: node, message: messageNode });
                }
                // (2)
                // remove message-argument from doubleQuoted list and make
                // sure it is a string-literal
                doubleQuotedStringLiterals.delete(messageNode);
                if (!isStringLiteral(messageNode)) {
                    context.report({
                        loc: messageNode.loc,
                        messageId: 'badMessage',
                        data: { message: context.getSourceCode().getText(node) }
                    });
                }
            }
            function reportBadStringsAndBadKeys() {
                // (1)
                // report all strings that are in double quotes
                for (const node of doubleQuotedStringLiterals) {
                    context.report({ loc: node.loc, messageId: 'doubleQuoted' });
                }
                for (const [key, values] of externalizedStringLiterals) {
                    // (2)
                    // report all invalid NLS keys
                    if (!key.match(NoUnexternalizedStrings._rNlsKeys)) {
                        for (let value of values) {
                            context.report({ loc: value.call.loc, messageId: 'badKey', data: { key } });
                        }
                    }
                    // (2)
                    // report all invalid duplicates (same key, different message)
                    if (values.length > 1) {
                        for (let i = 1; i < values.length; i++) {
                            if (context.getSourceCode().getText(values[i - 1].message) !== context.getSourceCode().getText(values[i].message)) {
                                context.report({ loc: values[i].call.loc, messageId: 'duplicateKey', data: { key } });
                            }
                        }
                    }
                }
            }
            return {
                ['Literal']: (node) => collectDoubleQuotedStrings(node),
                ['ExpressionStatement[directive] Literal:exit']: (node) => doubleQuotedStringLiterals.delete(node),
                ['CallExpression[callee.type="MemberExpression"][callee.object.name="nls"][callee.property.name="localize"]:exit']: (node) => visitLocalizeCall(node),
                ['CallExpression[callee.name="localize"][arguments.length>=2]:exit']: (node) => visitLocalizeCall(node),
                ['Program:exit']: reportBadStringsAndBadKeys,
            };
        }
    },
    _a._rNlsKeys = /^[_a-zA-Z0-9][ .\-_a-zA-Z0-9]*$/,
    _a);
