import { google } from "googleapis";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: "./database/.env" });

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

export function receiveCommandAdd(userMessageContent, messageStack) {
  try {
    const platformIndex = validatePlatformInMessage(
      userMessageContent,
      messageStack
    );

    const platform = userMessageContent[platformIndex];
    const channelName = userMessageContent.slice(platformIndex + 1).join(" ");
    console.log(
      `User: ${messageStack.member.user.tag} is adding ${channelName} to ${platform}`
    );

    if (platform === "youtube") {
      addYoutubeChannelToJson(channelName, messageStack);
    } else if (platform === "twitch") {
      addTwitchChannelToJson(channelName, messageStack);
    }
  } catch (error) {
    console.error(error);
    messageStack.channel.send(
      "Error occurred while adding the channel to watch list."
    );
  }
}

function validatePlatformInMessage(userMessageContent, messageStack) {
  const platformIndex =
    userMessageContent.indexOf("youtube") !== -1
      ? userMessageContent.indexOf("youtube")
      : userMessageContent.indexOf("twitch");
  if (platformIndex === -1) {
    messageStack.channel.send("Please specify youtube or twitch");
    return;
  }
  return platformIndex;
}

async function addYoutubeChannelToJson(channelName, messageStack) {
  const youtubeChannelData = await checkYoutubeForChannel(
    channelName,
    messageStack
  );
  if (!youtubeChannelData) {
    messageStack.channel.send("Channel not found");
    return;
  }

  await writeChannelToJson(youtubeChannelData, "youtube", messageStack);
  return true;
}

async function addTwitchChannelToJson(channelName, messageStack) {
  const twitchChannelData = await checkTwitchForChannel(
    channelName,
    messageStack
  );
  if (!twitchChannelData) {
    messageStack.channel.send("Channel not found");
    return;
  }

  await writeChannelToJson(twitchChannelData, "twitch", messageStack);
  return true;
}

async function checkYoutubeForChannel(channelName) {
  try {
    const response = await youtube.search.list({
      part: "snippet",
      q: channelName,
      type: "channel",
      maxResults: 1,
    });

    if (response.data.items.length > 0) {
      const item = response.data.items[0];
      return { id: item.id.channelId, name: item.snippet.title };
    }

    return null;
  } catch (err) {
    console.error(`Error checking Youtube for channel ${channelName}: ${err}`);
    return null;
  }
}

async function checkTwitchForChannel(channelName) {
  try {
    const response = await twitch.search.list({
      part: "snippet",
      q: channelName,
      type: "channel",
      maxResults: 1,
    });

    if (response.data.items.length > 0) {
      const item = response.data.items[0];
      return { id: item.id.channelId, name: item.snippet.title };
    }

    return null;
  } catch (err) {
    console.error(`Error checking Twitch for channel ${channelName}: ${err}`);
    return null;
  }
}

function writeChannelToJson(channelData, platform, messageStack) {
  const channel = {
    id: channelData.id,
    name: channelData.name,
  };

  try {
    const channels = JSON.parse(fs.readFileSync(`./database/${platform}.json`));
    const youtubeNames = channels.youtube.map((channel) => channel.name);

    if (youtubeNames.includes(channel.name)) {
      messageStack.channel.send(`Channel "${channel.name}" already exists`);
      console.log(
        `Channel "${channel.name}" already exists in ${platform}.json`
      );
      return;
    }

    channels.push(channel);
    fs.writeFileSync(`./database/${platform}.json`, JSON.stringify(channels));
    messageStack.channel.send(
      `Successfully added channel "${channel.name}" to watch list`
    );
    console.log(
      `Successfully added channel "${channel.name}" to ${platform}.json`
    );
  } catch (err) {
    console.error(`Error writing channel to ${platform}.json: ${err.message}`);
  }
}
