import { download as downloadOpenstax } from "./openstax";
import { download as downloadLibretexts } from "./libretexts";

if (process.argv.length === 2) {
	console.error("Expected at least one argument!");
	process.exit(1);
}

let address;

try {
	address = new URL(process.argv[2]);
} catch {
	console.log("Script argment must be a URL!");
	process.exit(1);
}

address.protocol = "https";

switch (address.host) {
	case "openstax.org":
		downloadOpenstax(address);
		break;
	case "bio.libretexts.org":
	case "biz.libretexts.org":
	case "chem.libretexts.org":
	case "eng.libretexts.org":
	case "espanol.libretexts.org":
	case "geo.libretexts.org":
	case "query.libretexts.org":
	case "med.libretexts.org":
	case "human.libretexts.org":
	case "k12.libretexts.org":
	case "math.libretexts.org":
	case "phys.libretexts.org":
	case "socialsci.libretexts.org":
	case "stats.libretexts.org":
	case "ukrayinska.libretexts.org":
	case "workforce.libretexts.org":
		downloadLibretexts(address);
		break;
	default:
		console.log("The requested website is not supported by this script!");
		process.exit(1);
}
