import puppeteer from "puppeteer";

export async function receiveCommandChallenge(
  userMessageContent,
  messageStack
) {
  console.log(
    `User: ${messageStack.member.user.tag} is requesting a challenge`
  );
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const userName = getUserNameWithoutDiscriminator(
      messageStack.member.user.tag
    );
    await navigateToChallengePage(page);
    await enterGameName(page, `${userName}'s Challenge`);
    // await setPresetsAndSize(page);
    // await setKomi(page);
    await setClocks(page);
    await createGame(page);

    const createdGameUrl = page.url();
    messageStack.channel.send(
      `${userName} has opened a challenge: ${createdGameUrl}`
    );
  } catch (error) {
    console.error("Error creating game:", error);
    messageStack.channel.send(
      "Failed to create the game. Please try again later."
    );
  } finally {
    await browser.close();
  }
}

async function navigateToChallengePage(page) {
  await page.goto("https://go.kahv.io/");
}

async function enterGameName(page, gameName) {
  try {
    const nameInputXPath = '//*[@id="main"]/div[2]/div/span/input';
    await page.waitForXPath(nameInputXPath, { timeout: 5000 });
    const nameInputElement = await page.$x(nameInputXPath);

    await nameInputElement[0].click({ clickCount: 3 });
    await nameInputElement[0].press("Backspace");
    await nameInputElement[0].type(gameName);
  } catch (error) {
    console.error("Error entering game name:", error);
  }
}

async function setPresetsAndSize(page) {
  try {
    // Click the "Standard" preset
    await page.waitForSelector("a.preset-option", { timeout: 5000 });
    await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a.preset-option"));
      const standardAnchor = anchors.find((a) => a.textContent === "Standard");
      if (standardAnchor) {
        standardAnchor.click();
      }
    });

    // Set the board size
    await page.select("select", "19");
  } catch (error) {
    console.error("Error setting presets and size:", error);
  }
}

async function setClocks(page) {
  const blackKomiInputXpath =
    '//*[@id="main"]/div[2]/div/div[1]/div[2]/div[2]/ul/li[1]/input';
  const whiteKomiInputXpath =
    '//*[@id="main"]/div[2]/div/div[1]/div[2]/div[2]/ul/li[2]/input';

  const blackInput = await page.$x(blackKomiInputXpath);
  const whiteInput = await page.$x(whiteKomiInputXpath);

  if (blackInput.length > 0 && whiteInput.length > 0) {
    await blackInput[0].click({ clickCount: 3 });
    await blackInput[0].type(String(-3.0));

    await whiteInput[0].click({ clickCount: 3 });
    await whiteInput[0].type(String(3.5));
  } else {
    console.error("Error: Unable to set komi settings");
  }
}

async function setClock(page) {
  const mainTimeInputXPath =
    '//*[@id="main"]/div[2]/div/div[1]/div[2]/div[3]/div/div[1]/input';
  const incrementTimeInputXPath =
    '//*[@id="main"]/div[2]/div/div[1]/div[2]/div[3]/div/div[2]/input';

  const mainTimeInput = await page.$x(mainTimeInputXPath);
  const incrementTimeInput = await page.$x(incrementTimeInputXPath);

  if (mainTimeInput.length > 0 && incrementTimeInput.length > 0) {
    await mainTimeInput[0].click({ clickCount: 3 });
    await mainTimeInput[0].type(String(10));

    await incrementTimeInput[0].click({ clickCount: 3 });
    await incrementTimeInput[0].type(String(30));
  } else {
    console.error("Error: Unable to set clock settings");
  }
}

async function createGame(page) {
  try {
    const createButtonXPath = '//*[@id="main"]/div[2]/div/button';
    await page.waitForXPath(createButtonXPath, { timeout: 5000 });
    const createButtonElement = await page.$x(createButtonXPath);

    await Promise.all([
      page.waitForNavigation(),
      createButtonElement[0].click(),
    ]);
  } catch (error) {
    console.error("Error creating game:", error);
  }
}

function getUserNameWithoutDiscriminator(userName) {
  return userName.replace(/#\d+$/, "");
}
