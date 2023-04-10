import fs from 'fs';

export function receiveCommandRemove(userMessageContent, messageStack) {
  try {
    const platformIndex = validatePlatformInMessage(userMessageContent, messageStack);

    const platform = userMessageContent[platformIndex];
    const channelName = userMessageContent.slice(platformIndex + 1).join(" ");
    console.log(`User: ${messageStack.member.user.tag} is removing ${channelName} from ${platform}`);

    const removed = removeChannelFromJson(channelName, platform);
    if (removed) {
      messageStack.channel.send(`Channel ${channelName} removed from watch list`);
    } else {
      messageStack.channel.send(`Channel ${channelName} is not in the watch list`);
    }
  } catch (error) {
    console.error(error);
    messageStack.channel.send("Error occurred while removing the channel from watch list.");
  }
}

function removeChannelFromJson(channelName, platform) {
  const filePath = `./database/${platform}.json`;

  try {
    const channels = JSON.parse(fs.readFileSync(filePath));
    const filteredChannels = channels.filter((channel) => channel.name !== channelName);
    if (filteredChannels.length === channels.length) {
      return false;
    }
    fs.writeFileSync(filePath, JSON.stringify({ [platform]: filteredChannels }));
    console.log(`Removed ${channelName} from ${platform}.json`);
    return true;
  } catch (err) {
    console.error(`Error removing channel from ${platform}.json: ${err.message}`);
    return false;
  }
}

function validatePlatformInMessage(userMessageContent, messageStack) {
  const platformIndex = userMessageContent.indexOf("youtube") !== -1 ? userMessageContent.indexOf("youtube") : userMessageContent.indexOf("twitch");
  if (platformIndex === -1) {
    messageStack.channel.send("Please specify youtube or twitch");
    return;
  }
  return platformIndex;
}
