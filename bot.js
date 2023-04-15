import { hourlyLiveStreamNotifications, getNotificationChannelsFromJson } from './src/live.js'
import { receiveCommandChallenge } from './src/challenge.js'
import { receiveCommandTsumego } from './src/tsumego.js'
import { receiveCommandBattle } from './src/battle.js'
import { receiveCommandRemove } from './src/remove.js'
// import { receiveCommandSgf } from './src/sgf.js'
import { receiveCommandHere } from './src/here.js'
import { receiveCommandAdd } from './src/add.js'

import pkg from 'discord.js'
import dotenv from 'dotenv'
dotenv.config({ path: './database/.env' })

const { TOKEN, PREFIX } = process.env
const { Client, GatewayIntentBits, PermissionsBitField } = pkg
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

const returnCommandList = () => {
  return `**Commands List**\n
  **!here** - This will add specific channels to their respective places. You must be an admin to set.
        examples: !here notifications | !here tsumego | !here battles\n
  **!tsumego** - This will display the list of tsumego problems.
        example: !tsumego 1k | !tsumego q-123456 \n
  **!battle** - This command send a message to participating servers:
        example: !battle 10 https://pk.101weiqi.com/not_a_real_link \n
  `
}

client.login(TOKEN)

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)

  const scheduledVideosToPost = []

  hourlyLiveStreamNotifications(client, scheduledVideosToPost)

  // Calculate time remaining until the next hour
  const now = new Date()
  const millisecondsUntilNextHour =
    60 * 60 * 1000 -
    (now.getMinutes() * 60 * 1000 +
      now.getSeconds() * 1000 +
      now.getMilliseconds())

  // Set a timeout to start the hourly interval on the hour
  setTimeout(() => {
    // Call hourlyLiveNotifications every hour
    setInterval(() => {
      hourlyLiveStreamNotifications(client, scheduledVideosToPost)
    }, 60 * 60 * 1000)

    // Call hourlyLiveNotifications for the first time on the hour
    hourlyLiveStreamNotifications(client, scheduledVideosToPost)
  }, millisecondsUntilNextHour)

  // Check for scheduled videos every 10 minute
  setInterval(async () => {
    const now = new Date()
    const tenMinutesBefore = new Date(now.getTime() + 10 * 60 * 1000)
    const guildsNotificationChannels = await getNotificationChannelsFromJson()

    for (let i = scheduledVideosToPost.length - 1; i >= 0; i--) {
      const scheduledVideo = scheduledVideosToPost[i]
      const videoScheduledStartTime = new Date(
        scheduledVideo.videoScheduledStartTime
      )

      if (videoScheduledStartTime <= tenMinutesBefore) {
        // Post the scheduled video notification
        const message = `${scheduledVideo.channelName} will be live in 10 minutes!\n${scheduledVideo.videoTitle}\n${scheduledVideo.videoURL}`
        guildsNotificationChannels.forEach((channel) => {
          try {
            client.channels.cache.get(channel).send(message)
            console.log(`Posted ${message} to ${channel}`)
          } catch (error) {
            console.error(
              `Error posting message to channel ${channel}: ${error}`
            )
            console.error(error.stack)
          }
        })

        // Remove the scheduled video from the list
        scheduledVideosToPost.splice(i, 1)
      }
    }
  }, 10 * 60 * 1000)
})

client.on('messageCreate', (discordMessageStack) => {
  if (
    discordMessageStack.author.bot ||
    !discordMessageStack.content.toLowerCase().startsWith(PREFIX)
  ) {
    return
  }

  const args = discordMessageStack.content
    .slice(PREFIX.length)
    .trim()
    .split(/ +/)
  const command = args.shift().toLowerCase()
  if (command) {
    readUserSentCommand(command, args, discordMessageStack)
  }
})

function readUserSentCommand (
  commandSentByUser,
  userMessageContent,
  messageStack
) {
  const doesUserHavePermission = messageStack.member.permissions.has([
    PermissionsBitField.Flags.KickMembers,
    PermissionsBitField.Flags.BanMembers
  ])

  const Tangjie = '128781081292832768'

  switch (commandSentByUser) {
    case 'add':
      if (messageStack.author.id === Tangjie) {
        receiveCommandAdd(userMessageContent, messageStack)
      } else {
        messageStack.channel.send('You do not have permission to use this.')
      }
      break
    case 'remove':
      if (messageStack.author.id === Tangjie) {
        receiveCommandRemove(userMessageContent, messageStack)
      } else {
        messageStack.channel.send('You do not have permission to use this.')
      }
      break
    case 'tsumego':
      receiveCommandTsumego(userMessageContent, messageStack)
      break
    case 'battle':
      receiveCommandBattle(userMessageContent, messageStack, client)
      break
    case 'sgf':
      // receiveCommandSGF(userMessageContent, messageStack)
      break
    case 'challenge':
      receiveCommandChallenge(userMessageContent, messageStack)
      break
    case 'here':
      if (doesUserHavePermission) {
        receiveCommandHere(userMessageContent, messageStack)
      } else {
        messageStack.channel.send('You do not have permission to use this.')
      }
      break
    case 'help':
      messageStack.channel.send(returnCommandList())
      break
    default:
      messageStack.channel.send('Command not found.')
      break
  }
}
