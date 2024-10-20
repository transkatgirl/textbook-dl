import { Builder, Browser, By, WebDriver } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome";
import { JSDOM } from "jsdom";
import { RawNavItem, RawTextbookMetadata } from "./builder";
import path from "path";

// Note: OpenStax CSS is from https://openstax.org/rex/releases/v4/bdd6a22/static/css/main.7cf7796a.chunk.css (last retrieved on Sept 1 2024), then modified to remove custom fonts and add a 1em margin around the body element.

export async function download(address: URL, debug = false) {
	console.log("Starting WebDriver...");

	const options = new Options();
	options.addArguments("--window-size=1600,1200");
	if (!debug) {
		options.addArguments("--headless");
	}
	const driver = await new Builder()
		.forBrowser(Browser.CHROME)
		.setChromeOptions(options)
		.build();

	console.log("Loading URL " + address.href);
	await driver.get(address.href);

	await initPage(driver);

	console.log("Attempting to find book title...");
	const titleElement = await driver.findElement(
		By.css('[data-testid="bookbanner"] a[data-testid="details-link-expanded"]')
	);
	const bookTitle = await titleElement.getText();
	const bookAddress = await titleElement.getAttribute("href");

	console.log(bookTitle + " by OpenStax - " + bookAddress);

	console.log("Attempting to find table of contents...");
	const toc = await driver.findElement(By.css('nav[data-testid="toc"] > ol'));

	for (let i = 0; i < 4; i++) {
		console.log(
			"Attempting to expand table of contents (iteration " + (i + 1) + ")..."
		);

		const items = await toc.findElements(By.css("details:not([open])"));

		for (const item of items) {
			if (await item.isDisplayed()) {
				await item.click();
			}
		}
	}

	const tocHTML = await toc.getAttribute("innerHTML");

	console.log("Parsing table of contents...");

	const dom = new JSDOM(
		'<!DOCTYPE html><body><ol id="toc-root">' + tocHTML + "</ol></body>",
		{
			url: address.href,
		}
	);
	const document = dom.window.document;

	const tocRoot = document.getElementById("toc-root");

	if (!tocRoot) {
		return;
	}

	const nav = parseToc(tocRoot);

	const meta: RawTextbookMetadata = {
		title: bookTitle,
		creators: ["OpenStax"],
		lang: "en",
		url: new URL(bookAddress),
	};

	const pages = await downloadPages(driver, meta, nav).then(
		(pages) => new Map(pages)
	);

	await driver.quit();

	const stylesheet = path.resolve(__dirname, "../src/openstax.css");

	if (pages) {
		return {
			meta,
			nav,
			pages,
			stylesheet,
		};
	}
}

async function initPage(driver: WebDriver) {
	console.log("\nWaiting 6 seconds for page to load...");
	await new Promise((resolve) => setTimeout(resolve, 6000));

	await driver.manage().setTimeouts({ implicit: 500 });

	console.log("Attempting to dismiss any pop-ups...");

	const buttons_1 = await driver.findElements(
		By.css(".osano-cm-window__dialog button.osano-cm-accept")
	);

	const buttons_2 = await driver.findElements(
		By.css(
			'[data-analytics-region="Nudge Study Tools"] button[aria-label="close overlay"]'
		)
	);

	const buttons_3 = await driver.findElements(
		By.css("#_pi_surveyWidget ._pi_closeButton")
	);

	const buttons = buttons_1.concat(buttons_2).concat(buttons_3);

	for (const button of buttons) {
		if (await button.isDisplayed()) {
			await button.click();

			await new Promise((resolve) => setTimeout(resolve, 3000));
		}
	}

	await driver.manage().setTimeouts({ implicit: 3000 });
}

function parseToc(root: HTMLElement) {
	const items: RawNavItem[] = [];

	for (const element of root.children) {
		if (element.tagName == "LI") {
			const item = handleListingItem(element as HTMLLIElement);

			if (item) {
				items.push(item);
			}
		}
	}

	return items;
}

function handleListingItem(element: HTMLLIElement): RawNavItem | void {
	if (element.getAttribute("data-type") == "page") {
		for (const childElement of element.children) {
			if (childElement.tagName == "A" && childElement.textContent) {
				return {
					label: childElement.textContent,
					url: new URL((childElement as HTMLAnchorElement).href),
					subitems: [],
				};
			}
		}
	}
	if (
		element.getAttribute("data-type") == "chapter" ||
		element.getAttribute("data-type") == "unit" ||
		element.getAttribute("data-type") == "eoc-dropdown" ||
		element.getAttribute("data-type") == "eob-dropdown"
	) {
		for (const childElement of element.children) {
			if (childElement.tagName == "DETAILS") {
				return handleListingDropdown(childElement as HTMLDetailsElement);
			}
		}
	}
}

function handleListingDropdown(element: HTMLDetailsElement): RawNavItem | void {
	let label = "";
	const subitems: RawNavItem[] = [];

	for (const childElement of element.children) {
		if (childElement.tagName == "SUMMARY") {
			const element = childElement;

			for (const childElement of element.getElementsByTagName("span")) {
				if (childElement.textContent && childElement.children.length == 0) {
					label += childElement.textContent;
				}
			}
		}
		if (childElement.tagName == "OL") {
			const element = childElement;

			for (const childElement of element.children) {
				if (childElement.tagName == "LI") {
					const item = handleListingItem(childElement as HTMLLIElement);

					if (item) {
						subitems.push(item);
					}
				}
			}
		}
	}

	if (label.length > 0 && subitems.length > 0) {
		return {
			label,
			subitems,
		};
	}
}

async function downloadPages(
	driver: WebDriver,
	meta: RawTextbookMetadata,
	nav: RawNavItem[]
): Promise<[string, string][]> {
	const downloaded: [string, string][] = [];

	for (let i = 0; i < nav.length; i++) {
		const item = nav[i];

		if (item.url) {
			const filename = path.basename(item.url.pathname);

			const download = await downloadPage(driver, item.url);

			if (download) {
				downloaded.push([filename, download]);
			}
			nav[i].filename = filename;
		}
		if (item.subitems.length > 0) {
			const subitemDownload = await downloadPages(driver, meta, item.subitems);

			for (const download of subitemDownload) {
				downloaded.push(download);
			}
		}
	}

	return downloaded;
}

async function downloadPage(
	driver: WebDriver,
	address: URL
): Promise<string | void> {
	console.log("\nLoading URL " + address.href);
	await driver.get(address.href);

	await initPage(driver);

	console.log("Attempting to get page content...");
	const main = await driver.findElement(By.id("main-content"));

	const content = await main.getAttribute("innerHTML");

	console.log("Parsing content...");

	const dom = new JSDOM(
		'<!DOCTYPE html><body><div id="main-content">' + content + "</div></body>",
		{
			url: address.href,
		}
	);
	const document = dom.window.document;

	const frames = document.getElementsByTagName("iframe");

	while (frames.length > 0) {
		for (const frame of frames) {
			const anchor = document.createElement("a");
			const lazy_src = frame.getAttribute("data-lazy-src");

			if (lazy_src) {
				frame.removeAttribute("data-lazy-src");
				frame.setAttribute("src", lazy_src);
			}

			if (!frame.src.startsWith("http")) {
				throw "Invalid src attribute";
			}

			anchor.setAttribute("href", frame.src);
			anchor.textContent = "View multimedia content";
			anchor.setAttribute("style", "display: inherit!important;");

			frame.replaceWith(anchor);
		}
	}

	/* for (const element of document.getElementsByTagName("image")) {
		const img = document.createElement("img");
		const src = element.getAttribute("src");

		if (!src) {
			throw "Missing src attribute";
		}

		img.src = src;

		const alt = element.getAttribute("alt");
		if (alt) {
			img.alt = alt;
		}
		element.replaceWith(img);
	} */

	const images = document.getElementsByTagName("img");

	for (const image of images) {
		const lazy_src = image.getAttribute("data-lazy-src");

		if (lazy_src) {
			image.removeAttribute("data-lazy-src");
			image.setAttribute("src", lazy_src);
		}

		if (image.src.length > 0) {
			image.setAttribute("src", image.src);
		}
	}

	const anchors = document.getElementsByTagName("a");

	for (const anchor of anchors) {
		if (anchor.getAttribute("href")?.startsWith("../../")) {
			anchor.setAttribute("href", anchor.href);
		}
	}

	for (const element of document.querySelectorAll(
		".MathJax_Preview, .MathJax_Display, .MathJax"
	)) {
		element.remove();
	}

	for (const element of document.querySelectorAll('script[type="math/mml"]')) {
		const container = document.createElement("div");
		container.innerHTML = element.innerHTML;

		const math = container.querySelector("math");

		if (math) {
			element.replaceWith(math);
		}
	}

	console.log("Archived " + address.href);

	return document.body.innerHTML;
}
