import puppeteer from "puppeteer";
import sharp from "sharp";

export async function receiveCommandTsumego(userMessageContent, messageStack) {
  try {
    console.log(`User: ${messageStack.member.user.tag} is requesting 101`);

    if (!userMessageContent[0]) {
      messageStack.channel.send("Please provide a level or a Q-number.");
      return;
    }

    const levelOrQNumber = userMessageContent[0];
    const pageURL = await getPageURL(levelOrQNumber);

    if (!pageURL) {
      messageStack.channel.send(
        "Invalid input. Please provide a valid level or Q-number."
      );
      return;
    }

    console.log(pageURL);
    const { croppedScreenshotBuffer, levelText } =
      await getScreenshotAndLevelText(pageURL, messageStack);

    messageStack.channel.send({
      content: `${levelText}\n <${pageURL}>`,
      files: [
        {
          attachment: croppedScreenshotBuffer,
          name: "tsumego.png",
        },
      ],
    });
  } catch (error) {
    console.error("Error:", error);
    messageStack.channel.send("An error occurred while processing your request.");
  }
}

async function getPageURL(levelOrQNumber) {
  const levelPattern = /^([1-9]|1[0-5])[kK]|\d[dD]$/;
  const qNumberPattern = /^[qQ]-\d+$/;

  if (levelPattern.test(levelOrQNumber)) {
    const rankNumber = parseInt(levelOrQNumber.slice(0, -1), 10);
    const rankLetter = levelOrQNumber.slice(-1).toLowerCase();

    if (
      (rankLetter === "k" && rankNumber >= 1 && rankNumber <= 15) ||
      (rankLetter === "d" && rankNumber >= 1 && rankNumber <= 7)
    ) {
      return await getRandomLevelTsumegoURL(levelOrQNumber);
    }
  } else if (qNumberPattern.test(levelOrQNumber)) {
    return `https://www.101weiqi.com/q/${levelOrQNumber.substring(2)}`;
  }
  return null;
}

async function getRandomLevelTsumegoURL(level) {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
  });

  try {
    const page = await browser.newPage();
    const pageNumber = randomInt(1, 50);
    const levelPageURL = `https://www.101weiqi.com/${level}/?page=${pageNumber}`;
    await page.goto(levelPageURL);

    const problems = await getProblemsFromPage(page);
    const randomProblemIndex = randomInt(0, problems.length - 1);
    const problemNumber = problems[randomProblemIndex];
    const problemURL = `https://www.101weiqi.com/q/${problemNumber}`;

    return problemURL;
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await browser.close();
  }
}

async function getProblemsFromPage(page) {
  return await page.$$eval(".width100 > div > a", (links) =>
    links.map((link) => {
      const problemText = link
        .querySelector("span.warptext")
        .textContent.trim();

      const problemNumber = problemText.substring(2).split(" ")[0].slice(0, -4);

      return problemNumber;
    })
  );
}

async function getScreenshotAndLevelText(url, messageStack) {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
  });

  try {
    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForSelector("#wcanvas_1");

    const wcanvasRect = await getWCanvasRect(page);
    const levelText = await getLevelText(page);

    const fullPageScreenshotBuffer = await page.screenshot({ fullPage: true });
    const croppedScreenshotBuffer = await getCroppedScreenshotBuffer(
      fullPageScreenshotBuffer,
      wcanvasRect
    );

    return {
      croppedScreenshotBuffer,
      levelText,
    };
  } catch (error) {
    messageStack.channel.send("Couldn't find webpage. Please check that the Q-number is correct.");
    console.error("Error:", error);
  } finally {
    await browser.close();
  }
}

async function getWCanvasRect(page) {
  return await page.evaluate(() => {
    const wcanvasElement = document.querySelector("#wcanvas_1");
    const rect = wcanvasElement.getBoundingClientRect();
    return {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  });
}

async function getLevelText(page, messageStack) {
  const levelElement = await page.$("small.ng-binding.ng-scope");
  const levelText = await page.evaluate(
    (element) => element.textContent.trim(),
    levelElement
  );

  const blackFirstElement = await page.$(
    "span.ng-scope[ng-if='qq.blackfirst']"
  );
  const whiteFirstElement = await page.$(
    "span.ng-scope[ng-if='!qq.blackfirst']"
  );

  let color;
  if (blackFirstElement) {
    color = "Black";
  } else if (whiteFirstElement) {
    color = "White";
  } else {
    messageStack.channel.send("Couldn't find color information. Please check that the Q-number is correct.");
    throw new Error("Color information not found");
  }

  return `${color} to play ${levelText}`;
}

async function getCroppedScreenshotBuffer(
  fullPageScreenshotBuffer,
  wcanvasRect
) {
  return await sharp(fullPageScreenshotBuffer)
    .extract({
      left: Math.round(wcanvasRect.left),
      top: Math.round(wcanvasRect.top),
      width: Math.round(wcanvasRect.width),
      height: Math.round(wcanvasRect.height),
    })
    .toBuffer();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
