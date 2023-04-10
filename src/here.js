import fs from 'fs';

export function receiveCommandHere(userMessageContent, messageStack){
  console.log(`User: ${messageStack.member.user.tag} is adding ${messageStack.channel.name} to ${messageStack.guild.name}`)

  const channelType = validateChannelType(userMessageContent, messageStack);

  if (!channelType) {
    return;
  }

  const guild = {
    name: messageStack.guild.name,
    id: messageStack.guild.id
  };

  const channels = {
    id: messageStack.channel.id,
    name: messageStack.channel.name,
    type: channelType
  };

  if (!writeGuildToJson(guild, channels, messageStack)) {
    messageStack.channel.send("Error occurred while adding the channel.");
  }
}

function validateChannelType(userMessageContent, messageStack) {
  const channelType = userMessageContent[0];
  console.log(channelType)
  if (!['notifications', 'tsumego', 'battles', 'sgf'].includes(channelType)) {
    messageStack.channel.send('Please specify notifications, tsumego, battles, or sgf.');
    return null;
  }
  return channelType;
}

async function writeGuildToJson(guild, channels, messageStack) {
  try {
    const data = fs.readFileSync('./database/channels.json');
    const parsedData = data.length ? JSON.parse(data) : { guilds: [] };
    const guilds = parsedData.guilds || [];
    const guildIndex = guilds.findIndex(g => g.id === guild.id);

    if (guildIndex >= 0) {
      if (guilds[guildIndex].channels[channels.type]) {
        // Channel type already exists
        const confirmation = await messageStack.channel.send(
          `Channel type ${channels.type} already exists for ${guild.name}. Do you want to overwrite it? (yes/no)`
        );
        const filter = m => m.author.id === messageStack.author.id;
        const collected = await messageStack.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });

        const response = collected.first().content.toLowerCase();
        if (response !== 'yes') {
          messageStack.channel.send('Channel type update canceled.');
          return false;
        }
      }
      guilds[guildIndex].channels[channels.type] = channels;
    } else {
      guilds.push({
        name: guild.name,
        id: guild.id,
        channels: {
          [channels.type]: channels
        }
      });
    }

    fs.writeFileSync('./database/channels.json', JSON.stringify({ guilds }));
    messageStack.channel.send(`Successfully added channel ${channels.name} to ${channels.type} in ${guild.name}`);
    console.log(`Successfully added channel ${channels.name} to ${channels.type} in ${guild.name}`);
    return true;
  } catch (err) {
    console.error(`Error writing channel to channels.json: ${err.message}`);
    return false;
  }
}
