"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path = require("path");
const byline = require("byline");
const ripgrep_1 = require("@vscode/ripgrep");
const Parser = require("tree-sitter");
const node_fetch_1 = require("node-fetch");
const { typescript } = require('tree-sitter-typescript');
const product = require('../../product.json');
function isNlsString(value) {
    return value ? typeof value !== 'string' : false;
}
function isStringArray(value) {
    return !value.some(s => isNlsString(s));
}
function isNlsStringArray(value) {
    return value.every(s => isNlsString(s));
}
var PolicyType;
(function (PolicyType) {
    PolicyType[PolicyType["StringEnum"] = 0] = "StringEnum";
})(PolicyType || (PolicyType = {}));
function renderADMLString(prefix, moduleName, nlsString, translations) {
    let value;
    if (translations) {
        const moduleTranslations = translations[moduleName];
        if (moduleTranslations) {
            value = moduleTranslations[nlsString.nlsKey];
        }
    }
    if (!value) {
        value = nlsString.value;
    }
    return `<string id="${prefix}_${nlsString.nlsKey}">${value}</string>`;
}
class BasePolicy {
    constructor(policyType, name, category, minimumVersion, description, moduleName) {
        this.policyType = policyType;
        this.name = name;
        this.category = category;
        this.minimumVersion = minimumVersion;
        this.description = description;
        this.moduleName = moduleName;
    }
    renderADMLString(nlsString, translations) {
        return renderADMLString(this.name, this.moduleName, nlsString, translations);
    }
    renderADMX(regKey) {
        return [
            `<policy name="${this.name}" class="Both" displayName="$(string.${this.name})" explainText="$(string.${this.name}_${this.description.nlsKey})" key="Software\\Policies\\Microsoft\\${regKey}" presentation="$(presentation.${this.name})">`,
            `	<parentCategory ref="${this.category.name.nlsKey}" />`,
            `	<supportedOn ref="Supported_${this.minimumVersion.replace(/\./g, '_')}" />`,
            `	<elements>`,
            ...this.renderADMXElements(),
            `	</elements>`,
            `</policy>`
        ];
    }
    renderADMLStrings(translations) {
        return [
            `<string id="${this.name}">${this.name}</string>`,
            this.renderADMLString(this.description, translations)
        ];
    }
    renderADMLPresentation() {
        return `<presentation id="${this.name}">${this.renderADMLPresentationContents()}</presentation>`;
    }
}
class BooleanPolicy extends BasePolicy {
    static from(name, category, minimumVersion, description, moduleName, settingNode) {
        const type = getStringProperty(settingNode, 'type');
        if (type !== 'boolean') {
            return undefined;
        }
        return new BooleanPolicy(name, category, minimumVersion, description, moduleName);
    }
    constructor(name, category, minimumVersion, description, moduleName) {
        super(PolicyType.StringEnum, name, category, minimumVersion, description, moduleName);
    }
    renderADMXElements() {
        return [
            `<boolean id="${this.name}" valueName="${this.name}">`,
            `	<trueValue><decimal value="1" /></trueValue><falseValue><decimal value="0" /></falseValue>`,
            `</boolean>`
        ];
    }
    renderADMLPresentationContents() {
        return `<checkBox refId="${this.name}">${this.name}</checkBox>`;
    }
}
class IntPolicy extends BasePolicy {
    constructor(name, category, minimumVersion, description, moduleName, defaultValue) {
        super(PolicyType.StringEnum, name, category, minimumVersion, description, moduleName);
        this.defaultValue = defaultValue;
    }
    static from(name, category, minimumVersion, description, moduleName, settingNode) {
        const type = getStringProperty(settingNode, 'type');
        if (type !== 'number') {
            return undefined;
        }
        const defaultValue = getIntProperty(settingNode, 'default');
        if (typeof defaultValue === 'undefined') {
            throw new Error(`Missing required 'default' property.`);
        }
        return new IntPolicy(name, category, minimumVersion, description, moduleName, defaultValue);
    }
    renderADMXElements() {
        return [
            `<decimal id="${this.name}" valueName="${this.name}" />`
            // `<decimal id="Quarantine_PurgeItemsAfterDelay" valueName="PurgeItemsAfterDelay" minValue="0" maxValue="10000000" />`
        ];
    }
    renderADMLPresentationContents() {
        return `<decimalTextBox refId="${this.name}" defaultValue="${this.defaultValue}">${this.name}</decimalTextBox>`;
    }
}
class StringPolicy extends BasePolicy {
    static from(name, category, minimumVersion, description, moduleName, settingNode) {
        const type = getStringProperty(settingNode, 'type');
        if (type !== 'string') {
            return undefined;
        }
        return new StringPolicy(name, category, minimumVersion, description, moduleName);
    }
    constructor(name, category, minimumVersion, description, moduleName) {
        super(PolicyType.StringEnum, name, category, minimumVersion, description, moduleName);
    }
    renderADMXElements() {
        return [`<text id="${this.name}" valueName="${this.name}" required="true" />`];
    }
    renderADMLPresentationContents() {
        return `<textBox refId="${this.name}"><label>${this.name}:</label></textBox>`;
    }
}
class StringEnumPolicy extends BasePolicy {
    constructor(name, category, minimumVersion, description, moduleName, enum_, enumDescriptions) {
        super(PolicyType.StringEnum, name, category, minimumVersion, description, moduleName);
        this.enum_ = enum_;
        this.enumDescriptions = enumDescriptions;
    }
    static from(name, category, minimumVersion, description, moduleName, settingNode) {
        const type = getStringProperty(settingNode, 'type');
        if (type !== 'string') {
            return undefined;
        }
        const enum_ = getStringArrayProperty(settingNode, 'enum');
        if (!enum_) {
            return undefined;
        }
        if (!isStringArray(enum_)) {
            throw new Error(`Property 'enum' should not be localized.`);
        }
        const enumDescriptions = getStringArrayProperty(settingNode, 'enumDescriptions');
        if (!enumDescriptions) {
            throw new Error(`Missing required 'enumDescriptions' property.`);
        }
        else if (!isNlsStringArray(enumDescriptions)) {
            throw new Error(`Property 'enumDescriptions' should be localized.`);
        }
        return new StringEnumPolicy(name, category, minimumVersion, description, moduleName, enum_, enumDescriptions);
    }
    renderADMXElements() {
        return [
            `<enum id="${this.name}" valueName="${this.name}">`,
            ...this.enum_.map((value, index) => `	<item displayName="$(string.${this.name}_${this.enumDescriptions[index].nlsKey})"><value><string>${value}</string></value></item>`),
            `</enum>`
        ];
    }
    renderADMLStrings(translations) {
        return [
            ...super.renderADMLStrings(translations),
            ...this.enumDescriptions.map(e => this.renderADMLString(e, translations))
        ];
    }
    renderADMLPresentationContents() {
        return `<dropdownList refId="${this.name}" />`;
    }
}
const IntQ = {
    Q: `(number) @value`,
    value(matches) {
        const match = matches[0];
        if (!match) {
            return undefined;
        }
        const value = match.captures.filter(c => c.name === 'value')[0]?.node.text;
        if (!value) {
            throw new Error(`Missing required 'value' property.`);
        }
        return parseInt(value);
    }
};
const StringQ = {
    Q: `[
		(string (string_fragment) @value)
		(call_expression function: (identifier) @localizeFn arguments: (arguments (string (string_fragment) @nlsKey) (string (string_fragment) @value)) (#eq? @localizeFn localize))
	]`,
    value(matches) {
        const match = matches[0];
        if (!match) {
            return undefined;
        }
        const value = match.captures.filter(c => c.name === 'value')[0]?.node.text;
        if (!value) {
            throw new Error(`Missing required 'value' property.`);
        }
        const nlsKey = match.captures.filter(c => c.name === 'nlsKey')[0]?.node.text;
        if (nlsKey) {
            return { value, nlsKey };
        }
        else {
            return value;
        }
    }
};
const StringArrayQ = {
    Q: `(array ${StringQ.Q})`,
    value(matches) {
        if (matches.length === 0) {
            return undefined;
        }
        return matches.map(match => {
            return StringQ.value([match]);
        });
    }
};
function getProperty(qtype, node, key) {
    const query = new Parser.Query(typescript, `(
			(pair
				key: [(property_identifier)(string)] @key
				value: ${qtype.Q}
			)
			(#eq? @key ${key})
		)`);
    return qtype.value(query.matches(node));
}
function getIntProperty(node, key) {
    return getProperty(IntQ, node, key);
}
function getStringProperty(node, key) {
    return getProperty(StringQ, node, key);
}
function getStringArrayProperty(node, key) {
    return getProperty(StringArrayQ, node, key);
}
// TODO: add more policy types
const PolicyTypes = [
    BooleanPolicy,
    IntPolicy,
    StringEnumPolicy,
    StringPolicy,
];
function getPolicy(moduleName, configurationNode, settingNode, policyNode, categories) {
    const name = getStringProperty(policyNode, 'name');
    if (!name) {
        throw new Error(`Missing required 'name' property.`);
    }
    else if (isNlsString(name)) {
        throw new Error(`Property 'name' should be a literal string.`);
    }
    const categoryName = getStringProperty(configurationNode, 'title');
    if (!categoryName) {
        throw new Error(`Missing required 'title' property.`);
    }
    else if (!isNlsString(categoryName)) {
        throw new Error(`Property 'title' should be localized.`);
    }
    const categoryKey = `${categoryName.nlsKey}:${categoryName.value}`;
    let category = categories.get(categoryKey);
    if (!category) {
        category = { moduleName, name: categoryName };
        categories.set(categoryKey, category);
    }
    const minimumVersion = getStringProperty(policyNode, 'minimumVersion');
    if (!minimumVersion) {
        throw new Error(`Missing required 'minimumVersion' property.`);
    }
    else if (isNlsString(minimumVersion)) {
        throw new Error(`Property 'minimumVersion' should be a literal string.`);
    }
    const description = getStringProperty(settingNode, 'description');
    if (!description) {
        throw new Error(`Missing required 'description' property.`);
    }
    if (!isNlsString(description)) {
        throw new Error(`Property 'description' should be localized.`);
    }
    let result;
    for (const policyType of PolicyTypes) {
        if (result = policyType.from(name, category, minimumVersion, description, moduleName, settingNode)) {
            break;
        }
    }
    if (!result) {
        throw new Error(`Failed to parse policy '${name}'.`);
    }
    return result;
}
function getPolicies(moduleName, node) {
    const query = new Parser.Query(typescript, `
		(
			(call_expression
				function: (member_expression property: (property_identifier) @registerConfigurationFn) (#eq? @registerConfigurationFn registerConfiguration)
				arguments: (arguments	(object	(pair
					key: [(property_identifier)(string)] @propertiesKey (#eq? @propertiesKey properties)
					value: (object (pair
						key: [(property_identifier)(string)]
						value: (object (pair
							key: [(property_identifier)(string)] @policyKey (#eq? @policyKey policy)
							value: (object) @policy
						)) @setting
					))
				)) @configuration)
			)
		)
	`);
    const categories = new Map();
    return query.matches(node).map(m => {
        const configurationNode = m.captures.filter(c => c.name === 'configuration')[0].node;
        const settingNode = m.captures.filter(c => c.name === 'setting')[0].node;
        const policyNode = m.captures.filter(c => c.name === 'policy')[0].node;
        return getPolicy(moduleName, configurationNode, settingNode, policyNode, categories);
    });
}
async function getFiles(root) {
    return new Promise((c, e) => {
        const result = [];
        const rg = (0, child_process_1.spawn)(ripgrep_1.rgPath, ['-l', 'registerConfiguration\\(', '-g', 'src/**/*.ts', '-g', '!src/**/test/**', root]);
        const stream = byline(rg.stdout.setEncoding('utf8'));
        stream.on('data', path => result.push(path));
        stream.on('error', err => e(err));
        stream.on('end', () => c(result));
    });
}
function renderADMX(regKey, versions, categories, policies) {
    versions = versions.map(v => v.replace(/\./g, '_'));
    return `<?xml version="1.0" encoding="utf-8"?>
<policyDefinitions revision="1.1" schemaVersion="1.0">
	<policyNamespaces>
		<target prefix="${regKey}" namespace="Microsoft.Policies.${regKey}" />
	</policyNamespaces>
	<resources minRequiredRevision="1.0" />
	<supportedOn>
		<definitions>
			${versions.map(v => `<definition name="Supported_${v}" displayName="$(string.Supported_${v})" />`).join(`\n			`)}
		</definitions>
	</supportedOn>
	<categories>
		<category displayName="$(string.Application)" name="Application" />
		${categories.map(c => `<category displayName="$(string.Category_${c.name.nlsKey})" name="${c.name.nlsKey}"><parentCategory ref="Application" /></category>`).join(`\n		`)}
	</categories>
	<policies>
		${policies.map(p => p.renderADMX(regKey)).flat().join(`\n		`)}
	</policies>
</policyDefinitions>
`;
}
function renderADML(appName, versions, categories, policies, translations) {
    return `<?xml version="1.0" encoding="utf-8"?>
<policyDefinitionResources revision="1.0" schemaVersion="1.0">
	<displayName />
	<description />
	<resources>
		<stringTable>
			<string id="Application">${appName}</string>
			${versions.map(v => `<string id="Supported_${v.replace(/\./g, '_')}">${appName} &gt;= ${v}</string>`)}
			${categories.map(c => renderADMLString('Category', c.moduleName, c.name, translations))}
			${policies.map(p => p.renderADMLStrings(translations)).flat().join(`\n			`)}
		</stringTable>
		<presentationTable>
			${policies.map(p => p.renderADMLPresentation()).join(`\n			`)}
		</presentationTable>
	</resources>
</policyDefinitionResources>
`;
}
function renderGP(policies, translations) {
    const appName = product.nameLong;
    const regKey = product.win32RegValueName;
    const versions = [...new Set(policies.map(p => p.minimumVersion)).values()].sort();
    const categories = [...new Set(policies.map(p => p.category))];
    return {
        admx: renderADMX(regKey, versions, categories, policies),
        adml: [
            { languageId: 'en-us', contents: renderADML(appName, versions, categories, policies) },
            ...translations.map(({ languageId, languageTranslations }) => ({ languageId, contents: renderADML(appName, versions, categories, policies, languageTranslations) }))
        ]
    };
}
const Languages = {
    'fr': 'fr-fr',
    'it': 'it-it',
    'de': 'de-de',
    'es': 'es-es',
    'ru': 'ru-ru',
    'zh-hans': 'zh-cn',
    'zh-hant': 'zh-tw',
    'ja': 'ja-jp',
    'ko': 'ko-kr',
    'cs': 'cs-cz',
    'pt-br': 'pt-br',
    'tr': 'tr-tr',
    'pl': 'pl-pl',
};
async function getLatestStableVersion(updateUrl) {
    const res = await (0, node_fetch_1.default)(`${updateUrl}/api/update/darwin/stable/latest`);
    const { name: version } = await res.json();
    return version;
}
async function getSpecificNLS(resourceUrlTemplate, languageId, version) {
    const resource = {
        publisher: 'ms-ceintl',
        name: `vscode-language-pack-${languageId}`,
        version,
        path: 'extension/translations/main.i18n.json'
    };
    const url = resourceUrlTemplate.replace(/\{([^}]+)\}/g, (_, key) => resource[key]);
    const res = await (0, node_fetch_1.default)(url);
    if (res.status !== 200) {
        throw new Error(`[${res.status}] Error downloading language pack ${languageId}@${version}`);
    }
    const { contents: result } = await res.json();
    return result;
}
function previousVersion(version) {
    const [, major, minor, patch] = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    return `${major}.${parseInt(minor) - 1}.${patch}`;
}
async function getNLS(resourceUrlTemplate, languageId, version) {
    try {
        return await getSpecificNLS(resourceUrlTemplate, languageId, version);
    }
    catch (err) {
        if (/\[404\]/.test(err.message)) {
            console.warn(`Language pack ${languageId}@${version} is missing. Downloading previous version...`);
            return await getSpecificNLS(resourceUrlTemplate, languageId, previousVersion(version));
        }
        else {
            throw err;
        }
    }
}
async function parsePolicies() {
    const parser = new Parser();
    parser.setLanguage(typescript);
    const files = await getFiles(process.cwd());
    const base = path.join(process.cwd(), 'src');
    const policies = [];
    for (const file of files) {
        const moduleName = path.relative(base, file).replace(/\.ts$/i, '').replace(/\\/g, '/');
        const contents = await fs_1.promises.readFile(file, { encoding: 'utf8' });
        const tree = parser.parse(contents);
        policies.push(...getPolicies(moduleName, tree.rootNode));
    }
    return policies;
}
async function getTranslations() {
    const updateUrl = product.updateUrl;
    if (!updateUrl) {
        console.warn(`Skipping policy localization: No 'updateUrl' found in 'product.json'.`);
        return [];
    }
    const resourceUrlTemplate = product.extensionsGallery?.resourceUrlTemplate;
    if (!resourceUrlTemplate) {
        console.warn(`Skipping policy localization: No 'resourceUrlTemplate' found in 'product.json'.`);
        return [];
    }
    const version = await getLatestStableVersion(updateUrl);
    const languageIds = Object.keys(Languages);
    return await Promise.all(languageIds.map(languageId => getNLS(resourceUrlTemplate, languageId, version)
        .then(languageTranslations => ({ languageId, languageTranslations }))));
}
async function main() {
    const [policies, translations] = await Promise.all([parsePolicies(), getTranslations()]);
    const { admx, adml } = await renderGP(policies, translations);
    const root = '.build/policies/win32';
    await fs_1.promises.rm(root, { recursive: true, force: true });
    await fs_1.promises.mkdir(root, { recursive: true });
    await fs_1.promises.writeFile(path.join(root, `${product.win32RegValueName}.admx`), admx.replace(/\r?\n/g, '\n'));
    for (const { languageId, contents } of adml) {
        const languagePath = path.join(root, languageId === 'en-us' ? 'en-us' : Languages[languageId]);
        await fs_1.promises.mkdir(languagePath, { recursive: true });
        await fs_1.promises.writeFile(path.join(languagePath, `${product.win32RegValueName}.adml`), contents.replace(/\r?\n/g, '\n'));
    }
}
if (require.main === module) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
