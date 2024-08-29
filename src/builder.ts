export interface RawTextbookIndex {
	meta: RawTextbookMetadata;
	nav: RawNavItem[];
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

export function buildTextbook(
	input: RawTextbookIndex,
	pages: Map<string, string>
) {}
