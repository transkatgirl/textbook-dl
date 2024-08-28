import { Builder, Browser, By } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome";

export async function download(address: URL) {
	const options = new Options();
	options.addArguments("--window-size=1600,1200");
	const driver = await new Builder()
		.forBrowser(Browser.CHROME)
		.setChromeOptions(options)
		.build();

	await driver.get(address.href);

	console.log("Attempting to find table of contents...");
	const toc = await driver.findElement(By.css('nav[data-testid="toc"] > ol'));

	console.log("Attempting to find page content...");
	const main = await driver.findElement(
		By.css('#main-content > [data-type="page"]')
	);

	//const contentHTML = await revealed.getAttribute("innerHTML");

	//console.log(await revealed.getAttribute("innerHTML"));
}
