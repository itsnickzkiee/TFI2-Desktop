const puppeteer = require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path = require("path");
const { pathToFileURL } = require("url");
const dir = "C:/Users/Rominick/Desktop/TFI_NEW/design";

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(pathToFileURL(path.join(dir, "production-schedule-preview.html")).href, { waitUntil: "load" });

  const result = await page.evaluate(() => {
    const row = document.querySelector("#schedule-body tr");
    const name = row.querySelector('[data-field="productName"]');
    const code = row.querySelector('[data-field="code"]');
    const expectedA = window.TFI_PRODUCTION_SCHEDULE_DATA.groupCodes["MAYON DRY PEAS"];
    const expectedB = window.TFI_PRODUCTION_SCHEDULE_DATA.groupCodes["SENIORITA DRY PEAS"];
    const values = () => [...code.options].slice(1).map(option => option.value);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    const initial = code.disabled && code.options.length === 1 && code.value === "";
    name.value = "MAYON DRY PEAS";
    name.dispatchEvent(new Event("change", { bubbles: true }));
    const firstGroup = !code.disabled && same(values(), expectedA);

    code.value = expectedA[0];
    code.dispatchEvent(new Event("change", { bubbles: true }));
    name.value = "SENIORITA DRY PEAS";
    name.dispatchEvent(new Event("change", { bubbles: true }));
    const groupSwitch = !code.disabled && code.value === "" && same(values(), expectedB);

    document.querySelector("#reset-form").click();
    const reset = name.value === "" && code.disabled && code.options.length === 1 && code.value === "";

    return {
      initialBlankAndDisabled: initial,
      mayonDryPeasOptionsExact: firstGroup,
      switchingGroupReplacesOptionsAndClearsCode: groupSwitch,
      resetClearsAndDisablesCodeOptions: reset,
      mayonDryPeasExpectedCount: expectedA.length,
      senioritaDryPeasExpectedCount: expectedB.length
    };
  });

  await browser.close();
  const pass = Object.values(result).filter(value => typeof value === "boolean").every(Boolean) && errors.length === 0;
  console.log(JSON.stringify({ result, browserErrors: errors, pass }, null, 2));
  if (!pass) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
