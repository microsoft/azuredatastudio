"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const experimental_utils_1 = require("@typescript-eslint/experimental-utils");
module.exports = new class ApiLiteralOrTypes {
    constructor() {
        this.meta = {
            docs: { url: 'https://github.com/microsoft/vscode/wiki/Extension-API-guidelines#creating-objects' },
            messages: { sync: '`createXYZ`-functions are constructor-replacements and therefore must return sync', }
        };
    }
    create(context) {
        return {
            ['TSDeclareFunction Identifier[name=/create.*/]']: (node) => {
                const decl = node.parent;
                if (decl.returnType?.typeAnnotation.type !== experimental_utils_1.AST_NODE_TYPES.TSTypeReference) {
                    return;
                }
                if (decl.returnType.typeAnnotation.typeName.type !== experimental_utils_1.AST_NODE_TYPES.Identifier) {
                    return;
                }
                const ident = decl.returnType.typeAnnotation.typeName.name;
                if (ident === 'Promise' || ident === 'Thenable') {
                    context.report({
                        node,
                        messageId: 'sync'
                    });
                }
            }
        };
    }
};
