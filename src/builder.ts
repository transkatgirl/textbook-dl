import { cp, mkdir, writeFile } from "fs/promises";
import { JSDOM } from "jsdom";
import path from "path";
import url, { URL } from "url";
import { v4 as uuidv4, v7 as uuidv7 } from "uuid";

export interface RawTextbook {
	meta: RawTextbookMetadata;
	nav: RawNavItem[];
	pages: Map<string, string>;
	stylesheet?: string;
}

export interface RawTextbookMetadata {
	title: string;
	creators: string[];
	lang: string;
	url: URL;
}

export interface RawNavItem {
	label: string;
	url?: URL;
	filename?: string;
	subitems: RawNavItem[];
}

export async function buildTextbook(input: RawTextbook) {
	console.log("\nBuilding textbook...");

	const identifier = uuidv7();

	const root = path.join(path.join(process.cwd(), "output"), identifier);
	await mkdir(root, { recursive: true });

	await writeFile(path.join(root, "mimetype"), "application/epub+zip");

	const reservedRoot = path.join(root, "META-INF");
	await mkdir(reservedRoot);

	await writeFile(
		path.join(reservedRoot, "container.xml"),
		'<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="contents/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
	);

	const contentRoot = path.join(root, "contents");
	await mkdir(contentRoot);

	if (input.stylesheet) {
		await cp(input.stylesheet, path.join(contentRoot, "styles.css"));
	}

	await writeFile(
		path.join(contentRoot, "nav.xhtml"),
		buildNav(input.meta.lang, input.nav)
	);

	const filenameMappings = new Map();

	for (const filename of input.pages.keys()) {
		filenameMappings.set(filename, transformFilename(filename));
	}

	const mediaRoot = path.join(contentRoot, "media");
	await mkdir(mediaRoot);

	const mediaItems = new Map();

	for (const [filename, contents] of input.pages.entries()) {
		console.log("\nParsing " + filename + "...");

		const dom = new JSDOM(
			'<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:mathml="http://www.w3.org/1998/Math/MathML" xmlns:epub="http://www.idpf.org/2007/ops" lang="' +
				input.meta.lang +
				'"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body>' +
				contents +
				"</body></html>"
		);
		const document = dom.window.document;
		const XMLSerializer = dom.window.XMLSerializer;

		if (input.stylesheet) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.type = "text/css";
			link.href = "styles.css";

			document.head.appendChild(link);
		}

		console.log("Rewriting links...");

		for (const anchor of document.getElementsByTagName("a")) {
			const href = url.parse(anchor.href);

			if (!href || href.host || href.protocol || !href.pathname) {
				continue;
			}

			let path = href.pathname;

			if (path.startsWith("/")) {
				path = path.substring(1);
			}

			if (path.startsWith("./")) {
				path = path.substring(2);
			}

			if (filenameMappings.has(path)) {
				href.pathname = filenameMappings.get(path);

				//console.log(anchor.href + " -> " + url.format(href));

				anchor.href = url.format(href);
			}
		}

		for (const image of document.getElementsByTagName("img")) {
			if (image.srcset) {
				throw "Unimplemented attribute";
			}

			const src = URL.parse(image.src);
			if (!src) {
				throw "Unable to find <img> src";
			}

			console.log("Downloading " + src);

			const rateLimitPromise = new Promise((resolve) =>
				setTimeout(resolve, 500)
			);

			const response = await fetch(src);
			if (response.ok) {
				const mime = response.headers.get("Content-Type");

				if (!mime) {
					throw "Unable to find content-type";
				}

				let filename = uuidv4();

				switch (mime) {
					case "image/png":
						filename += ".png";
						break;
					case "image/jpeg":
						filename += ".jpg";
						break;
					case "image/gif":
						filename += ".gif";
						break;
					case "image/svg+xml":
						filename += ".svg";
						break;
					case "image/webp":
						throw "Unsupported MIME type";
					/* filename += ".webp";
						break; */
					default:
						throw "Unknown MIME type";
				}

				const body = await response.arrayBuffer();

				await writeFile(path.join(mediaRoot, filename), new DataView(body));
				image.src = "media/" + filename;
				mediaItems.set("media/" + filename, mime);
			} else {
				throw "Received status code " + response.status;
			}

			await rateLimitPromise;
		}

		for (const audio of document.getElementsByTagName("audio")) {
			const src = URL.parse(audio.src);
			if (!src) {
				throw "Unable to find <audio> src";
			}

			console.log("Downloading " + src);

			const rateLimitPromise = new Promise((resolve) =>
				setTimeout(resolve, 5000)
			);

			const response = await fetch(src);
			if (response.ok) {
				const mime = response.headers.get("Content-Type");

				if (!mime) {
					throw "Unable to find content-type";
				}

				let filename = uuidv4();

				switch (mime) {
					case "audio/mpeg":
						filename += ".mp3";
						break;
					case "audio/mp4":
						filename += ".mp4";
						break;
					case "audio/ogg; codecs=opus":
						throw "Unsupported MIME type";
					/* filename += ".ogg";
						break; */
					default:
						throw "Unknown MIME type";
				}

				const body = await response.arrayBuffer();

				await writeFile(path.join(mediaRoot, filename), new DataView(body));
				audio.src = "media/" + filename;
				mediaItems.set("media/" + filename, mime);
			} else {
				throw "Received status code " + response.status;
			}

			await rateLimitPromise;
		}

		for (const _ of document.getElementsByTagName("area")) {
			throw "Unimplemented element";
		}

		for (const _ of document.getElementsByTagName("picture")) {
			throw "Unimplemented element";
		}

		for (const _ of document.getElementsByTagName("source")) {
			throw "Unimplemented element";
		}

		for (const _ of document.getElementsByTagName("track")) {
			throw "Unimplemented element";
		}

		for (const _ of document.getElementsByTagName("video")) {
			throw "Unimplemented element";
		}

		for (const _ of document.getElementsByTagName("embed")) {
			throw "Unimplemented element";
		}

		for (const _ of document.getElementsByTagName("fencedframe")) {
			throw "Unimplemented element";
		}

		for (const _ of document.getElementsByTagName("iframe")) {
			throw "Unimplemented element";
		}

		for (const _ of document.getElementsByTagName("object")) {
			throw "Unimplemented element";
		}

		for (const _ of document.getElementsByTagName("portal")) {
			throw "Unimplemented element";
		}

		for (const _ of document.getElementsByTagName("frame")) {
			throw "Unimplemented element";
		}

		for (const _ of document.getElementsByTagName("image")) {
			throw "Unimplemented element";
		}

		for (const _ of document.getElementsByTagName("script")) {
			throw "Unimplemented element";
		}

		for (const _ of document.getElementsByTagName("form")) {
			throw "Unimplemented element";
		}

		for (const _ of document.getElementsByTagName("button")) {
			throw "Unimplemented element";
		}

		for (const _ of document.getElementsByTagName("canvas")) {
			throw "Unimplemented element";
		}

		const newFilename = transformFilename(filename);

		console.log("Serializing page as " + newFilename + "...");

		const serialized = new XMLSerializer().serializeToString(document);
		await writeFile(path.join(contentRoot, newFilename), serialized);
	}

	await writeFile(
		path.join(contentRoot, "content.opf"),
		buildPackage(input, mediaItems, identifier)
	);

	console.log("\nCreated EPUB with ID " + identifier);
}

function buildPackage(
	input: RawTextbook,
	resourceFiles: Map<string, string>,
	uuid: string
): string {
	console.log("Building EPUB package document...");

	const dom = new JSDOM(
		'<?xml version="1.0" encoding="utf-8"?><package version="3.0" unique-identifier="BookId" xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf"></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="nav"/></spine></package>',
		{ contentType: "text/xml" }
	);
	const document = dom.window.document;
	const XMLSerializer = dom.window.XMLSerializer;

	const metadata = document.getElementsByTagName("metadata")[0];

	const identifier = document.createElementNS(
		"http://purl.org/dc/elements/1.1/",
		"dc:identifier"
	);
	identifier.id = "BookId";
	identifier.textContent = "urn:uuid:" + uuid;
	metadata.appendChild(identifier);

	const title = document.createElementNS(
		"http://purl.org/dc/elements/1.1/",
		"dc:title"
	);
	title.textContent = input.meta.title;
	metadata.appendChild(title);

	for (const creator of input.meta.creators) {
		const element = document.createElementNS(
			"http://purl.org/dc/elements/1.1/",
			"dc:creator"
		);
		element.textContent = creator;
		metadata.appendChild(element);
	}

	const source = document.createElementNS(
		"http://purl.org/dc/elements/1.1/",
		"dc:source"
	);
	source.textContent = input.meta.url.href;
	metadata.appendChild(source);

	const description = document.createElementNS(
		"http://purl.org/dc/elements/1.1/",
		"dc:description"
	);
	description.textContent =
		"Downloaded from " + input.meta.url.href + " using textbook-dl";
	metadata.appendChild(description);

	const language = document.createElementNS(
		"http://purl.org/dc/elements/1.1/",
		"dc:language"
	);
	language.textContent = input.meta.lang;
	metadata.appendChild(language);

	const date = document.createElementNS("http://www.idpf.org/2007/opf", "meta");
	date.setAttribute("property", "dcterms:modified");
	date.textContent = new Date().toISOString().slice(0, -5) + "Z";
	metadata.appendChild(date);

	const manifest = document.getElementsByTagName("manifest")[0];
	const spine = document.getElementsByTagName("spine")[0];

	if (input.stylesheet) {
		const element = document.createElementNS(
			"http://www.idpf.org/2007/opf",
			"item"
		);
		element.setAttribute("id", "stylesheet");
		element.setAttribute("href", "styles.css");
		element.setAttribute("media-type", "text/css");

		manifest.appendChild(element);
	}

	let counter = 0;

	for (const filename of input.pages.keys()) {
		const manifestElement = document.createElementNS(
			"http://www.idpf.org/2007/opf",
			"item"
		);
		manifestElement.setAttribute("id", "s" + counter.toString());
		manifestElement.setAttribute("href", transformFilename(filename));
		manifestElement.setAttribute("media-type", "application/xhtml+xml");
		manifest.append(manifestElement);

		const spineElement = document.createElementNS(
			"http://www.idpf.org/2007/opf",
			"itemref"
		);
		spineElement.setAttribute("idref", "s" + counter.toString());
		spine.appendChild(spineElement);

		counter++;
	}

	counter = 0;

	for (const [resource, type] of resourceFiles.entries()) {
		const manifestElement = document.createElementNS(
			"http://www.idpf.org/2007/opf",
			"item"
		);
		manifestElement.setAttribute("id", "r" + counter.toString());
		manifestElement.setAttribute("href", resource);
		manifestElement.setAttribute("media-type", type);
		manifest.append(manifestElement);

		counter++;
	}

	return new XMLSerializer().serializeToString(document);
}

function buildNav(lang: string, nav: RawNavItem[]): string {
	console.log("Building EPUB navigation document...");

	const dom = new JSDOM(
		'<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="' +
			lang +
			'"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Book Navigation</title></head><body epub:type="frontmatter"><nav epub:type="toc" id="toc" role="doc-toc"><h1>Table of Contents</h1></nav><nav epub:type="landmarks" id="landmarks" hidden=""><h2>Landmarks</h2><ol><li><a epub:type="toc" href="#toc">Table of Contents</a></li></ol></nav></body></html>',
		{ contentType: "application/xhtml+xml" }
	);
	const document = dom.window.document;
	const XMLSerializer = dom.window.XMLSerializer;

	const toc = document.getElementById("toc");
	toc?.appendChild(buildNavList(document, nav));

	return new XMLSerializer().serializeToString(document);
}

function buildNavList(document: Document, nav: RawNavItem[]): HTMLOListElement {
	const root = document.createElement("ol");

	for (const item of nav) {
		const listItem = document.createElement("li");

		if (item.filename) {
			const anchor = document.createElement("a");
			anchor.href = transformFilename(item.filename);
			anchor.textContent = item.label;
			listItem.appendChild(anchor);
		} else {
			const span = document.createElement("span");
			span.textContent = item.label;
			listItem.appendChild(span);
		}

		if (item.subitems.length > 0) {
			listItem.appendChild(buildNavList(document, item.subitems));
		}

		root.appendChild(listItem);
	}

	return root;
}

function transformFilename(filename: string): string {
	if (filename.toLowerCase().endsWith(".xhtml")) {
		return filename;
	}

	if (filename.toLowerCase().endsWith(".html")) {
		return filename.substring(0, filename.length - 5) + ".xhtml";
	}

	if (filename.toLowerCase().endsWith(".htm")) {
		return filename.substring(0, filename.length - 4) + ".xhtml";
	}

	return filename + ".xhtml";
}
