// import { receiveCommandTsumego } from './src/tsumego.js';
import { receiveCommandBattle } from './src/battle.js';
import { receiveCommandRemove } from './src/remove.js';
// import { receiveCommandSgf } from './src/sgf.js';
import { receiveCommandHere } from './src/here.js';
import { hourlyLiveStreamNotifications } from './src/live.js';
import { receiveCommandAdd } from './src/add.js';



import pkg from 'discord.js';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: "./database/.env" });

const { TOKEN, PREFIX, YOUTUBE_API_KEY } = process.env;
const { Client, GatewayIntentBits, Permissions, PermissionsBitField } = pkg;
const client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]});

const SendCommandsList = () => {
  return `**Commands List**\n
  **!add** - This will add user or channel to the list of notifications. Please use the following format: **!add** {**youtube**, **twitch**} {**channel name**}
  **!battle** - This will send a message to all guilds and their linked channels with your battle link. Please use the following format: **!battle** **{time in minutes}** {**link**}
  **!here** - This adds the current channel to the list of channels that will receive notifications. Please use the following format: **!here** {**notifications**, **tsumego**, **battle**}
  **!help** - Displays this list of commands
  **!live** - This will display the list of live streams if you cannot wait for the hourly updates.
  **!remove** - This will remove user or channel from the list of notifications. Please use the following format: **!remove** {**youtube**, **twitch**} {**channel name**}
  **!sgf** - Creates a GIF from an SGF file.
  **!tsumego** - This will display the list of tsumego problems.
  `;
}

const channelJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'database', 'channels.json'), 'utf8'));
const youtubeJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'database', 'youtube.json'), 'utf8'));
const twitchJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'database', 'twitch.json'), 'utf8'));

const guilds = channelJson.guilds;

let twitchJsonChannels = twitchJson.twitch;
let youtubeJsonChannels = youtubeJson.youtube;

let scheduledStartTime = [];
let guildsNotificationChannels = [];
let guildsTsumegoChannels = [];
let guildsPvPChannels = [];

client.login(TOKEN);


client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);

  guilds.forEach(guild => {
    guildsNotificationChannels.push(guild.channels.notification);
    guildsTsumegoChannels.push(guild.channels.tsumego);
    guildsPvPChannels.push(guild.channels.battles);
  });

  hourlyLiveStreamNotifications(client, scheduledStartTime);

  // Calculate time remaining until the next hour
  const now = new Date();
  const millisecondsUntilNextHour = 60 * 60 * 1000 - (now.getMinutes() * 60 * 1000 + now.getSeconds() * 1000 + now.getMilliseconds());

  // Set a timeout to start the hourly interval on the hour
  setTimeout(() => {
    // Call hourlyLiveNotifications every hour
    setInterval(() => {
      hourlyLiveStreamNotifications(client, scheduledStartTime);
    }, 60 * 60 * 1000);

    // Call hourlyLiveNotifications for the first time on the hour
    hourlyLiveStreamNotifications(client, scheduledStartTime);
  }, millisecondsUntilNextHour);

  // Check for scheduled videos every 10 minute
  setInterval(() => {
    if (scheduledStartTime.length != 0) {
      console.log(`scheduled Streams ${scheduledStartTime.map(scheduledVideo => JSON.stringify(scheduledVideo)).join(", ")}`);
    }
    const now = new Date();
    const tenMinutesBefore = new Date(now.getTime() + 10 * 60 * 1000);

    for (const scheduledVideo of scheduledStartTime) {
      const videoScheduledStartTime = new Date(scheduledVideo.videoScheduledStartTime);
      if (videoScheduledStartTime <= tenMinutesBefore) {
        // Post the scheduled video notification
        const message = `${scheduledVideo.channelName} will be live in 10 minutes!\n${scheduledVideo.videoTitle}\n${scheduledVideo.videoURL}`;

        for (const channelId of guildsNotificationChannels) {

          const channel = client.channels.cache.get(channelId);

          if (channel) {
            channel.send(message);
          } else {
            console.error(`Channel with ID ${channelId} not found in cache.`);
          }
        }


        // Remove the scheduled video from the list
        const index = scheduledStartTime.indexOf(scheduledVideo);
        if (index !== -1) {
          scheduledStartTime.splice(index, 1);
        }
      }
    }
  }, 10 * 60 * 1000);
});


client.on('messageCreate', (discordMessageStack) => {
  if (discordMessageStack.author.bot || !discordMessageStack.content.toLowerCase().startsWith(PREFIX)) return;

  const args = discordMessageStack.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  if (command) {
    readUserSentCommand(command, args, discordMessageStack);
  }
});

function readUserSentCommand(commandSentByUser, userMessageContent, messageStack) {
    const doesUserHavePermission = (messageStack.member.permissions.has([PermissionsBitField.Flags.KickMembers, PermissionsBitField.Flags.BanMembers])) ? true : false;

    if (commandSentByUser === "add"){
      receiveCommandAdd(userMessageContent, messageStack);
    }

    if (commandSentByUser === "remove"){
      receiveCommandRemove(userMessageContent, messageStack);
    }

    if (commandSentByUser === "tsumego"){
      receiveCommandTsumego(userMessageContent, messageStack);
    }

    if (commandSentByUser === "battle"){
      receiveCommandBattle(userMessageContent, messageStack, client);
    }

    if (commandSentByUser === "sgf"){
      receiveCommandSGF(userMessageContent, messageStack);
    }

    if (commandSentByUser === "here" && doesUserHavePermission){
      receiveCommandHere(userMessageContent, messageStack);
    }

    if (commandSentByUser === "help"){
      messageStack.channel.send(SendCommandsList());
    }
  }
