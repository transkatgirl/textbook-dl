import { Builder, Browser, By, WebDriver } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome";
import { JSDOM } from "jsdom";
import { RawNavItem, RawTextbookMetadata } from "./builder";

export async function download(address: URL) {
	console.log("Starting WebDriver...");

	const options = new Options();
	options.addArguments("--window-size=1600,1200");
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

	await driver.quit();

	/*console.log("Attempting to get page list...");
	const tocItems = await toc.findElements(By.css('li[data-type="page"] > a'));

	const pages = new Map();

	for (const item of tocItems) {
		if (await item.isDisplayed()) {
			const contentURL = await item.getAttribute("href");

			await item.click();

			await initPage(driver);

			console.log("Attempting to get page content...");
			const main = await driver.findElement(By.id("main-content"));

			const contentHTML = await main.getAttribute("innerHTML");

			console.log("Archived " + contentURL);

			pages.set(contentURL, contentHTML);
		}
	}*/

	console.log("Parsing table of contents...");

	const dom = new JSDOM(
		'<!DOCTYPE html><body><ol id="toc-root">' + tocHTML + "</ol></body>",
		{
			url: address.href,
		}
	);
	const document = dom.window.document;

	const tocRoot = document.getElementById("toc-root");

	if (tocRoot) {
		console.log(parseToc(tocRoot));
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
	if (element.getAttribute("data-type") == "chapter") {
		for (const childElement of element.children) {
			if (childElement.tagName == "DETAILS") {
				return handleListingDropdown(childElement as HTMLDetailsElement);
			}
		}
	}
	if (element.getAttribute("data-type") == "eoc-dropdown") {
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

async function downloadTocPages(
	meta: RawTextbookMetadata,
	nav: RawNavItem[]
): Map<string, string> | void {
	console.log("Starting WebDriver...");

	const options = new Options();
	options.addArguments("--window-size=1600,1200");
	const driver = await new Builder()
		.forBrowser(Browser.CHROME)
		.setChromeOptions(options)
		.build();

	const downloaded = await downloadPages(driver, meta, nav);

	await driver.quit();

	return new Map(downloaded);
}

async function downloadPages(
	driver: WebDriver,
	meta: RawTextbookMetadata,
	items: RawNavItem[]
): Promise<[string, string][]> {
	const downloaded: [string, string][] = [];

	for (const item of items) {
		if (item.url) {
			const download = await downloadPage(driver, item.url);

			if (download) {
				downloaded.push([item.url.href, download]);
			}
		}
		if (item.subitems) {
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

	console.log("Archived " + address.href);

	return content;
}
