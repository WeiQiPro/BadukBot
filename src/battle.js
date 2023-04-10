import { Client } from "discord.js";
import fs from "fs";

export async function receiveCommandBattle(
  userMessageContent,
  messageStack,
  client
) {
  console.log(`User: ${messageStack.member.user.tag} is sending a battle`);

  const minutesToAdd = parseInt(userMessageContent[0], 10);
  const currentTime = new Date();
  const targetTime = new Date(currentTime.getTime() + minutesToAdd * 60000);
  const unixTimestamp = Math.floor(targetTime.getTime() / 1000);
  const timeStamp = `<t:${unixTimestamp}:R>`;

  const messageURLContent = userMessageContent.slice(1);
  const battleURL = getURLFromMessage(messageURLContent, messageStack);
  if (!battleURL) {
    return;
  }
  const userTag = messageStack.member.user.tag;
  const username = userTag.match(/^[^#]+/)[0];

  const messageSent = await sendBattleToChannels(
    username,
    timeStamp,
    battleURL,
    client
  );
  if (!messageSent) {
    messageStack.channel.send("Error sending message to channels");
    return;
  }
}

function getURLFromMessage(userMessageContent, messageStack) {
  const urlContains = "pk.101weiqi.com";
  const urlRegex = new RegExp(`https://${urlContains}`, "i");

  const messageContentString = userMessageContent.join(" ");
  const urlMatch = messageContentString.match(urlRegex);

  if (!urlMatch) {
    messageStack.channel.send("Please provide a pk link");
    return false;
  }

  // Find the end of the URL by looking for the first space character or the end of the string
  const urlEnd =
    messageContentString.indexOf(" ", urlMatch.index) !== -1
      ? messageContentString.indexOf(" ", urlMatch.index)
      : messageContentString.length;

  return messageContentString.slice(urlMatch.index, urlEnd);
}

async function sendBattleToChannels(user, timeStamp, battleURL, client) {
  const guildsData = JSON.parse(fs.readFileSync("./database/channels.json"));
  const guilds = guildsData.guilds;
  const battlesChannels = [];

  guilds.forEach((guild) => {
    if (guild.channels && guild.channels.battles) {
      battlesChannels.push(guild.channels.battles.id);
    }
  });

  try {
    for (const channel of battlesChannels) {
      const discordChannel = client.channels.cache.get(channel);
      await discordChannel.send(
        `${user} has made a new battle! Starting ${timeStamp}\n ${battleURL}`
      );
    }
  } catch (error) {
    console.error(
      `Error posting battle notifications to Discord channels: ${error}`
    );
    return false;
  }

  return true;
}
