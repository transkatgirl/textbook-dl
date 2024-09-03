import { JSDOM } from "jsdom";

export interface RawTextbook {
	meta: RawTextbookMetadata;
	nav: RawNavItem[];
	pages: Map<string, string>;
	stylesheet?: string;
}

export interface RawTextbookMetadata {
	title: string;
	author: string;
	url: URL;
}

export interface RawNavItem {
	label: string;
	url?: URL;
	filename?: string;
	subitems: RawNavItem[];
}

export function buildTextbook(input: RawTextbook) {
	for (const [filename, contents] of input.pages.entries()) {
		/*const document = new DOMParser().parseFromString(
			"<!DOCTYPE html><body>" + contents + "</body>",
			MIME_TYPE.HTML
		);*/

		const dom = new JSDOM("<!DOCTYPE html><body>" + contents + "</body>");
		const document = dom.window.document;

		const XMLSerializer = dom.window.XMLSerializer;

		const serialized = new XMLSerializer().serializeToString(document);
	}
}
