/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 * Please make sure to make edits in the .ts file at https://github.com/microsoft/vscode-loader/
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *--------------------------------------------------------------------------------------------*/
'use strict';
var CSSLoaderPlugin;
(function (CSSLoaderPlugin) {
    var BrowserCSSLoader = /** @class */ (function () {
        function BrowserCSSLoader() {
            this._pendingLoads = 0;
        }
        BrowserCSSLoader.prototype.attachListeners = function (name, linkNode, callback, errorback) {
            var unbind = function () {
                linkNode.removeEventListener('load', loadEventListener);
                linkNode.removeEventListener('error', errorEventListener);
            };
            var loadEventListener = function (e) {
                unbind();
                callback();
            };
            var errorEventListener = function (e) {
                unbind();
                errorback(e);
            };
            linkNode.addEventListener('load', loadEventListener);
            linkNode.addEventListener('error', errorEventListener);
        };
        BrowserCSSLoader.prototype._onLoad = function (name, callback) {
            this._pendingLoads--;
            callback();
        };
        BrowserCSSLoader.prototype._onLoadError = function (name, errorback, err) {
            this._pendingLoads--;
            errorback(err);
        };
        BrowserCSSLoader.prototype._insertLinkNode = function (linkNode) {
            this._pendingLoads++;
            var head = document.head || document.getElementsByTagName('head')[0];
            head.appendChild(linkNode);
        };
        BrowserCSSLoader.prototype.createLinkTag = function (name, cssUrl, externalCallback, externalErrorback) {
            var _this = this;
            var linkNode = document.createElement('link');
            linkNode.setAttribute('rel', 'stylesheet');
            linkNode.setAttribute('type', 'text/css');
            linkNode.setAttribute('data-name', name);
            var callback = function () { return _this._onLoad(name, externalCallback); };
            var errorback = function (err) { return _this._onLoadError(name, externalErrorback, err); };
            this.attachListeners(name, linkNode, callback, errorback);
            linkNode.setAttribute('href', cssUrl);
            return linkNode;
        };
        BrowserCSSLoader.prototype._linkTagExists = function (name, cssUrl) {
            var i, len, nameAttr, hrefAttr, links = document.getElementsByTagName('link');
            for (i = 0, len = links.length; i < len; i++) {
                nameAttr = links[i].getAttribute('data-name');
                hrefAttr = links[i].getAttribute('href');
                if (nameAttr === name || hrefAttr === cssUrl) {
                    return true;
                }
            }
            return false;
        };
        BrowserCSSLoader.prototype.load = function (name, cssUrl, externalCallback, externalErrorback) {
            if (this._linkTagExists(name, cssUrl)) {
                externalCallback();
                return;
            }
            var linkNode = this.createLinkTag(name, cssUrl, externalCallback, externalErrorback);
            this._insertLinkNode(linkNode);
        };
        return BrowserCSSLoader;
    }());
    // ------------------------------ Finally, the plugin
    var CSSPlugin = /** @class */ (function () {
        function CSSPlugin() {
            this._cssLoader = new BrowserCSSLoader();
        }
        CSSPlugin.prototype.load = function (name, req, load, config) {
            config = config || {};
            var cssConfig = config['vs/css'] || {};
            if (cssConfig.disabled) {
                // the plugin is asked to not create any style sheets
                load({});
                return;
            }
            var cssUrl = req.toUrl(name + '.css');
            this._cssLoader.load(name, cssUrl, function (contents) {
                load({});
            }, function (err) {
                if (typeof load.error === 'function') {
                    load.error('Could not find ' + cssUrl + ' or it was empty');
                }
            });
        };
        return CSSPlugin;
    }());
    CSSLoaderPlugin.CSSPlugin = CSSPlugin;
    define('vs/css', new CSSPlugin());
})(CSSLoaderPlugin || (CSSLoaderPlugin = {}));
