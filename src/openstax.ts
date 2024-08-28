import { Builder, Browser, By, WebDriver } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome";

export async function download(address: URL) {
	if (!address.pathname.startsWith("/books/")) {
		throw "Invalid URL!";
	}

	console.log("Starting WebDriver...");

	const options = new Options();
	options.addArguments("--window-size=1600,1200");
	const driver = await new Builder()
		.forBrowser(Browser.CHROME)
		.setChromeOptions(options)
		.build();
	await driver.manage().setTimeouts({ implicit: 3000 });

	console.log("Loading URL " + address.href);
	await driver.get(address.href);

	await initPage(driver);

	console.log("Attempting to find table of contents...");
	const toc = await driver.findElement(By.css('nav[data-testid="toc"] > ol'));

	for (let i = 0; i < 3; i++) {
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

	const tocItems = await toc.findElements(
		By.css('li[data-type="page"] > a span.os-text')
	);

	for (const item of tocItems) {
		if (await item.isDisplayed()) {
			const contentTitle = await item.getText();

			await item.click();

			await initPage(driver);

			console.log("Attempting to get page content...");
			const main = await driver.findElement(By.id("main-content"));

			const contentURL = await driver.getCurrentUrl();
			const contentHTML = await main.getAttribute("innerHTML");

			console.log("Archived " + contentTitle + " at " + contentURL);
		}
	}
}

async function initPage(driver: WebDriver) {
	console.log("\nWaiting 5 seconds for page to load...");
	await new Promise((resolve) => setTimeout(resolve, 5000));

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
