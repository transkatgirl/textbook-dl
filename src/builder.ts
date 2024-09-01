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

export function buildTextbook(input: RawTextbook) {}
