import { Builder, Browser, By, WebDriver } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome";

export async function download(address: URL) {
	const options = new Options();
	options.addArguments("--window-size=1600,1200");
	const driver = await new Builder()
		.forBrowser(Browser.CHROME)
		.setChromeOptions(options)
		.build();
	await driver.manage().setTimeouts({ implicit: 3000 });

	await driver.get(address.href);

	await cleanPage(driver);

	console.log("Attempting to find table of contents...");
	const toc = await driver.findElement(By.css('nav[data-testid="toc"] > ol'));

	const tocItems = await toc.findElements(By.css('li[data-type="page"] > a'));

	console.log(tocItems.length);

	/*const tocItems = await driver.findElements(
		By.css('li[data-type="chapter"] > details')
	);*/

	/*const tocItems = await toc.findElements(By.xpath("./child::*"));

	for (const item of tocItems) {
		await item.click();

		console.log("Waiting 5 seconds for page to load...");
		await new Promise((resolve) => setTimeout(resolve, 5000));
	}*/

	console.log("Attempting to find page content...");
	const main = await driver.findElement(
		By.css('#main-content > [data-type="page"]')
	);

	//const contentHTML = await main.getAttribute("innerHTML");
}

async function cleanPage(driver: WebDriver) {
	console.log("Waiting 5 seconds for page to load...");
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
		await button.click();

		await new Promise((resolve) => setTimeout(resolve, 2000));
	}

	await driver.manage().setTimeouts({ implicit: 3000 });
}
