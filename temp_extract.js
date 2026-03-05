const jsdom = require("jsdom");
const { JSDOM } = jsdom;

async function extract() {
    const res = await fetch('https://innings.pages.dev/Prime/');
    const html = await res.text();

    // We will inject the HTML into JSDOM and intercept the variables!
    const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://innings.pages.dev/Prime/" });

    setTimeout(() => {
        // Find DRM keys and MPD using the window.ui or the script scope
        // BUT the script is isolated so we might need a simpler trick: finding the string array or regex it.
    }, 1000);
}

// Alternatively, let's just parse the obfuscated string array
async function extractDirectly() {
    const res = await fetch('https://innings.pages.dev/Prime/');
    const html = await res.text();

    // The obfuscated code contains an array of strings like _0xedf98e=['mLRnR','522f/cenc.','tyWWY',...]
    const match = html.match(/const _0xedf98e=\[(.*?)\];/);
    if (match) {
        const arr = eval('[' + match[1] + ']');
        console.log("Extracted strings:", arr);
    }
}
extractDirectly();
