/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as React from 'react';

import { ICellOutput } from '../src/notebook/contracts/content';
import { RenderMimeRegistry } from './registry';
import * as outputProcessor from './common/outputProcessor';
import { MimeModel } from './common/mimemodel';

export interface IOutputItemProps {
    output: ICellOutput;
    registry: RenderMimeRegistry;
    trusted: boolean;
}

export interface IOutputItemState {
    node: Element;
}
export class OutputItem extends React.Component<IOutputItemProps, IOutputItemState> {
    nodeRef: React.RefObject<HTMLDivElement>;
    constructor(props) {
        super(props);
        this.nodeRef = React.createRef();
    }

    render() {
        return <div ref={this.nodeRef}></div>;
    }

    componentDidMount() {
        let node = this.nodeRef.current;
        let output = this.props.output;
        let options = outputProcessor.getBundleOptions({ value: output, trusted: this.props.trusted });
        // TODO handle safe/unsafe mapping
        this.createRenderedMimetype(options, node);
    }

    private get registry(): RenderMimeRegistry {
        return this.props.registry;
    }

    /**
     * Render a mimetype
     */
    protected createRenderedMimetype(options: MimeModel.IOptions, node: HTMLElement): void {
        let mimeType = this.registry.preferredMimeType(
            options.data,
            options.trusted ? 'any' : 'ensure'
        );
        if (mimeType) {
            // let metadata = model.metadata;
            // let mimeMd = metadata[mimeType] as ReadonlyJSONObject;
            // let isolated = false;
            // // mime-specific higher priority
            // if (mimeMd && mimeMd['isolated'] !== undefined) {
            //     isolated = mimeMd['isolated'] as boolean;
            // } else {
            //     // fallback on global
            //     isolated = metadata['isolated'] as boolean;
            // }

            let output = this.registry.createRenderer(mimeType);
            output.node = node;
            // if (isolated === true) {
            //     output = new Private.IsolatedRenderer(output);
            // }
            let model = new MimeModel(options);
            output.renderModel(model).catch(error => {
                // Manually append error message to output
                output.node.innerHTML = `<pre>Javascript Error: ${error.message}</pre>`;
                // Remove mime-type-specific CSS classes
                output.node.className = 'p-Widget jp-RenderedText';
                output.node.setAttribute(
                    'data-mime-type',
                    'application/vnd.jupyter.stderr'
                );
            });

            this.setState({ node: node });
        } else {
            // TODO Localize
            node.innerHTML =
                `No ${options.trusted ? '' : '(safe) '}renderer could be ` +
                'found for output. It has the following MIME types: ' +
                Object.keys(options.data).join(', ');

            this.setState({ node: node });
        }
    }
}
