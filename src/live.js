import fs from "fs";
import fetch from "node-fetch";
import { parse } from "node-html-parser";
import { google } from "googleapis";
import { Message } from "discord.js";

import dotenv from 'dotenv';
dotenv.config({ path: "./database/.env" });

const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY });


export async function hourlyLiveStreamNotifications(client, scheduledStartTime) {
  try {
    const now = new Date();
    const notificationChannels = await getNotificationChannelsFromJson();
    const liveStreamVideos = await getLiveStreamsVideos();

    for (let i = liveStreamVideos.length - 1; i >= 0; i--) {
      const scheduledVideo = liveStreamVideos[i];
      const videoScheduledStartTime = new Date(scheduledVideo.videoScheduledStartTime);
      if (videoScheduledStartTime > now) {
        if(!scheduledStartTime.includes(scheduledVideo)) {
          liveStreamVideos.splice(i, 1);
          continue
        } else {
          scheduledStartTime.push(scheduledVideo);
          liveStreamVideos.splice(i, 1);
        }
      }
    }

    const lastMessages = await getChannelsLastMessages(client, notificationChannels);

    const lastBotMessages = lastMessages.map((messages) => messages.filter((message) => message.author.id === client.user.id));

    postLiveVideosToChannels(lastBotMessages, liveStreamVideos, notificationChannels, client);
  } catch (error) {
    console.error(`Error in hourlyLiveStreamNotifications: ${error}`);
  }
}

function postLiveVideosToChannels(lastBotMessages, liveStreamVideos, notificationChannels, client) {
  for (const liveStreamVideo of liveStreamVideos) {
    const message = `${liveStreamVideo.channelName} is live!\n${liveStreamVideo.videoTitle}\n${liveStreamVideo.videoURL}`;
    const messageStack = lastBotMessages.find((messages) =>
      messages.find((message) => {
        // Check if the message includes the liveStreamVideo URL
        return message.content.includes(liveStreamVideo.videoURL);
      })
    );
    for (const channel of notificationChannels) {
      if (!messageStack) {
        client.channels.cache.get(channel).send(message);
        console.log(`Posted ${message} to ${channel}`);
      }
    }
  }
}


async function getChannelsLastMessages(client, channels) {
  try {
    return await Promise.all(
      channels
        .map((channelId) => client.channels.cache.get(channelId))
        .filter((channel) => channel && channel.type === 0) // Filter out non-text channels
        .map((channel) => channel.messages.fetch({ limit: 100 }))
    );
  } catch (error) {
    console.error(`Error in getChannelsLastMessages: ${error}`);
    return [];
  }
}

async function getNotificationChannelsFromJson() {
  const guildsData = JSON.parse(fs.readFileSync("./database/channels.json"));
  const guilds = guildsData.guilds;
  const notificationChannels = [];

  for (const guild of guilds) {
    if (guild.channels && guild.channels.notifications) {
      notificationChannels.push(guild.channels.notifications.id);
    }
  }

  return notificationChannels;
}





async function getLiveStreamsVideos() {
  const youtubeChannels = JSON.parse(fs.readFileSync("./database/youtube.json"));
  // const twitchChannels = JSON.parse(fs.readFileSync("./database/twitch.json"));

  const youtubeLiveStreams = await getLiveStreamsFromYoutube(youtubeChannels);
  // const twitchLiveStreams = await getLiveStreamsFromTwitch(twitchChannels);

  return youtubeLiveStreams;
}

async function getYoutubeLiveStreams(channelIds) {
  const liveStreams = [];

  for (const channelId of channelIds) {
    const { isStreaming, canonicalURL } = await isChannelStreaming(channelId);

    if (isStreaming) {
      const videoId = canonicalURL.split('/watch?v=')[1];
      const videoDetails = await getVideoDetails(videoId);
      const scheduledStartTime = new Date(videoDetails.liveStreamingDetails.scheduledStartTime);
      const videoTitle = videoDetails.snippet.title;

      liveStreams.push({
        title: videoTitle,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        scheduledStartTime,
      });
    }
  }

  return liveStreams;
}

async function isChannelStreaming(channelId) {
  const response = await fetch(`https://youtube.com/channel/${channelId}/live`);
  const text = await response.text();
  const html = parse(text);
  const canonicalURLTag = html.querySelector('link[rel=canonical]');
  const canonicalURL = canonicalURLTag.getAttribute('href');
  const isStreaming = canonicalURL.includes('/watch?v=');

  return { isStreaming, canonicalURL };
}

async function getVideoDetails(videoId) {
  const response = await youtube.videos.list({
    part: 'snippet,liveStreamingDetails',
    id: videoId,
  });

  return response.data.items[0];
}

async function getLiveStreamsFromYoutube(youtubeChannels) {
  const youtubeLiveStreams = [];

  for (const channel of youtubeChannels) {
    const liveVideos = await getYoutubeLiveStreams([channel.id]);
    if (liveVideos.length > 0) {
      const liveVideo = liveVideos[0]; // Assuming there's only one live stream per channel
      const liveStream = {
        channelName: channel.name,
        channelURL: channel.url,
        videoTitle: liveVideo.title,
        videoURL: liveVideo.url,
        videoScheduledStartTime: liveVideo.scheduledStartTime,
      };
      youtubeLiveStreams.push(liveStream);
    }
  }

  return youtubeLiveStreams;
}
