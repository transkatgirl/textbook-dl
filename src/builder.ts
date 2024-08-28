export interface RawTextbook {
	meta: RawTextbookMetadata;
	nav: RawNavItem[];
	pages: Map<string, string>;
}

export interface RawTextbookMetadata {
	title: string;
	authors?: string[];
	publisher?: string;
	language?: string;
	url?: string;
}

export interface RawNavItem {
	label: string;
	href?: string;
	subitems: RawNavItem[];
}

export function buildTextbook(input: RawTextbook) {}
