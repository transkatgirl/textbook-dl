export interface RawTextbook {
	meta: RawTextbookMetadata;
	nav: RawNavItem[];
	pages: Map<string, string>;
}

export interface RawTextbookMetadata {
	title: string;
	author: string;
	url: URL;
}

export interface RawNavItem {
	label: string;
	url?: URL;
	subitems: RawNavItem[];
}

export function buildTextbook(input: RawTextbook) {}
