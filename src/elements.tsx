/// <reference path="./jsx/element-types.d.ts" />
/// <reference path="./jsx/events.d.ts" />
/// <reference path="./jsx/intrinsic-elements.d.ts" />

type AttributeValue = number | string | Date | boolean;

export type ContentType = JSX.IRenderNode | string;

export interface CustomElementHandler {
    (attributes: Attributes | undefined, contents: ContentType[]): RenderNode;
}

export interface Attributes {
    [key: string]: AttributeValue;
}

const capitalACharCode = 'A'.charCodeAt(0);
const capitalZCharCode = 'Z'.charCodeAt(0);

const isUpper = (input: string, index: number) => {
    const charCode = input.charCodeAt(index);
    return capitalACharCode <= charCode && capitalZCharCode >= charCode;
};

const toKebabCase = (camelCased: string) => {
    let kebabCased = '';
    for (let i = 0; i < camelCased.length; i++) {
        const prevUpperCased = i > 0 ? isUpper(camelCased, i - 1) : true;
        const currentUpperCased = isUpper(camelCased, i);
        const nextUpperCased = i < camelCased.length - 1 ? isUpper(camelCased, i + 1) : true;
        if (!prevUpperCased && currentUpperCased || currentUpperCased && !nextUpperCased) {
            kebabCased += '-';
            kebabCased += camelCased[i].toLowerCase();
        } else {
            kebabCased += camelCased[i];
        }
    }
    return kebabCased;
};

const escapeAttrNodeValue = (value: string) => {
    return value.replace(/(&)|(")|(\u00A0)/g, function (_, amp, quote) {
        if (amp) return '&amp;';
        if (quote) return '&quot;';
        return '&nbsp;';
    });
};

const attributeToString = (attributes: Attributes) => (name: string): string => {
    const value = attributes[name];
    const formattedName = toKebabCase(name);
    const makeAttribute = (value: string) => `${formattedName}="${value}"`;
    if (value instanceof Date) {
        return makeAttribute(value.toISOString());
    } else switch (typeof value) {
        case 'boolean':
            // https://www.w3.org/TR/2008/WD-html5-20080610/semantics.html#boolean
            if (value) {
                return formattedName;
            } else {
                return '';
            }
        default:
            return makeAttribute(escapeAttrNodeValue(value?.toString() ?? ''));
    }
};

const attributesToString = (attributes: Attributes | undefined): string => {
    if (attributes) {
        return ' ' + Object.keys(attributes)
            .map(attributeToString(attributes))
            .filter(attribute => attribute.length) // filter out negative boolean attributes
            .join(' ');
    } else {
        return '';
    }
};

const flattenContents = (contents: (ContentType | Array<ContentType>)[]): ContentType[] => {
    const results: ContentType[] = [];

    for (const content of contents) {
        if (
            content instanceof RenderNode ||
            content instanceof TextNode
        ) {
            results.push(content);
        } else if (Array.isArray(content)) {
            results.push(...flattenContents(content as Array<ContentType | Array<ContentType>>));
        } else {
            results.push(
                ('' + content)
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
            );
        }
    }

    return results;
}

const isVoidElement = (tagName: string) => {
    return [
        'area',
        'base',
        'br',
        'col',
        'command',
        'embed',
        'hr',
        'img',
        'input',
        'keygen',
        'link',
        'meta',
        'param',
        'source',
        'track',
        'wbr'
    ].indexOf(tagName) > -1;
};

// Node for unescaped text
export class TextNode implements JSX.IRenderNode {
    constructor(readonly contents: string) { }

    toString(): string {
        return this.contents;
    }
}

export class RenderNode implements JSX.IRenderNode {
    constructor(
        readonly tagName: string,
        readonly attributes: Attributes | undefined,
        readonly children: ContentType[],
    ) { }

    toString() {
        if (isVoidElement(this.tagName) && !this.children.length) {
            return `<${this.tagName}${attributesToString(this.attributes)}>`;
        } else {
            const contents: string = this.children.length > 0 ? this.children.map(child => {
                if (typeof child === 'string') {
                    return child;
                } else {
                    return child.toString();
                }
            }).join('') : '';
            return `<${this.tagName}${attributesToString(this.attributes)}>${contents}</${this.tagName}>`;
        }
    }
}

export function createElement(
    name: string | CustomElementHandler,
    attributes: Attributes | undefined,
    ...rawContents: (ContentType | Array<ContentType>)[]
): JSX.IRenderNode {
    let contents: (ContentType | Array<ContentType>)[] = rawContents;
    if (attributes && attributes['dangerousInnerHtml']) {
        // Overwrite the contents with the given html
        contents = [new TextNode('' + attributes['dangerousInnerHtml'])];
        delete attributes['dangerousInnerHtml'];
    }

    if (typeof name === 'function') {
        return name(attributes, flattenContents(contents));
    } else {
        const tagName = toKebabCase(name);
        const node = new RenderNode(
            tagName,
            attributes,
            flattenContents(contents),
        );
        return node;
    }
}
