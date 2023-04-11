import fs from "fs";
import fetch from "node-fetch";
import { parse } from "node-html-parser";
import { google } from "googleapis";

import dotenv from "dotenv";
dotenv.config({ path: "./database/.env" });

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

export async function hourlyLiveStreamNotifications(
  client,
  scheduledVideosToPost
) {
  try {
    const now = new Date();
    const notificationChannels = await getNotificationChannelsFromJson();
    const liveStreamVideos = await getLiveStreamsVideos();

    for (let i = liveStreamVideos.length - 1; i >= 0; i--) {
      const scheduledVideo = liveStreamVideos[i];

      if (scheduledVideo.videoScheduledStartTime == "Invalid Date") {
        scheduledVideo.videoScheduledStartTime = new Date() - 60 * 60 * 1000;
      }

      const videoScheduledStartTime = new Date(
        scheduledVideo.videoScheduledStartTime
      );
      if (videoScheduledStartTime > now) {
        if (
          scheduledVideosToPost.some(
            (video) => video.videoURL === scheduledVideo.videoURL
          )
        ) {
          liveStreamVideos.splice(i, 1);
          continue;
        } else if (videoScheduledStartTime - now < 60 * 60 * 1000) {
          scheduledVideosToPost.push(scheduledVideo);
          liveStreamVideos.splice(i, 1);
        } else {
          liveStreamVideos.splice(i, 1);
        }
      }
    }

    postLiveVideosToChannels(liveStreamVideos, notificationChannels, client);
  } catch (error) {
    console.error(`Error in hourlyLiveStreamNotifications: ${error}`);
  }
}

async function postLiveVideosToChannels(
  liveStreamVideos,
  notificationChannels,
  client
) {
  for (const liveStreamVideo of liveStreamVideos) {
    const message = `${liveStreamVideo.channelName} is live!\n${liveStreamVideo.videoTitle}\n${liveStreamVideo.videoURL}`;
    for (const channel of notificationChannels) {
      const messages = await client.channels.cache
        .get(channel)
        .messages.fetch({ limit: 25 });
      const messageWithUrl = messages.find((msg) =>
        msg.content.includes(liveStreamVideo.videoURL)
      );
      if (!messageWithUrl) {
        client.channels.cache.get(channel).send(message);
        console.log(`Posted ${message} to ${channel}`);
      }
    }
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
  const youtubeChannels = JSON.parse(
    fs.readFileSync("./database/youtube.json")
  );
  const youtubeLiveStreams = await getLiveStreamsFromYoutube(youtubeChannels);

  return youtubeLiveStreams;
}

async function getYoutubeLiveStreams(channelIds) {
  const liveStreams = [];

  for (const channelId of channelIds) {
    const { isStreaming, canonicalURL } = await isChannelStreaming(channelId);
    if (isStreaming != false && canonicalURL != "") {
      const videoId = canonicalURL.split("/watch?v=")[1];
      const videoDetails = await getVideoDetails(videoId);
      const scheduledStartTime = new Date(
        videoDetails.liveStreamingDetails.scheduledStartTime
      );
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
  try {
    const response = await fetch(
      `https://youtube.com/channel/${channelId}/live`
    );
    const text = await response.text();
    const html = parse(text);
    const canonicalURLTag = html.querySelector("link[rel=canonical]");
    const canonicalURL = canonicalURLTag
      ? canonicalURLTag.getAttribute("href")
      : "";
    const isStreaming = canonicalURL.includes("/watch?v=");

    return { isStreaming, canonicalURL };
  } catch (error) {
    console.error(`Error in isChannelStreaming: ${error}`);
    return { isStreaming: false, canonicalURL: "" };
  }
}

async function getVideoDetails(videoId) {
  try {
    const response = await youtube.videos.list({
      part: "snippet,liveStreamingDetails",
      id: videoId,
    });

    if (response.data && response.data.items.length > 0) {
      return response.data.items[0];
    } else {
      throw new Error("No video details found.");
    }
  } catch (error) {
    console.error(`Error in getVideoDetails: ${error}`);
    return {};
  }
}

async function getLiveStreamsFromYoutube(youtubeChannels) {
  const youtubeLiveStreams = [];

  for (const channel of youtubeChannels) {
    const liveVideos = await getYoutubeLiveStreams([channel.id]);
    if (liveVideos.length > 0) {
      const liveVideo = liveVideos[0]; // Assuming there's only one live stream per channel
      const liveStream = {
        channelName: channel.name,
        channelURL: `https://www.youtube.com/${channel.name}`,
        videoTitle: liveVideo.title,
        videoURL: liveVideo.url,
        videoScheduledStartTime: liveVideo.scheduledStartTime,
      };
      youtubeLiveStreams.push(liveStream);
    }
  }

  return youtubeLiveStreams;
}
