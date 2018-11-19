const discord = require('discord.js');
const request = require('request');
const client = new discord.Client();

// Your bots login token
const bot_token = 'ENTER_BOT_TOKEN';

// The command to trigger the fetch
const bot_command = "'events"

// Enter your api information from https://coinmarketcal.com/
const coinmarketcal_client_id = 'ENTER_CLIENT_ID';
const coinmarketcal_client_secret= 'ENTER_CLIENT_SECRET';

// The discord channel ID for your bot
const chanId = 'ENTER_CHANNEL_ID';

// Change this to show more events
const maxEventCount = 5; 

// This will automatically post in the channel every 3 days (259200) Set to 0 to disable
const timeOut = 259200;

const authEndpoint = 'https://api.coinmarketcal.com/oauth/v2/token';
const listEndpoint = 'https://api.coinmarketcal.com/v1/events';

var lastPosted = Math.floor(new Date().getTime() / 1000);

// Gets the authentication token from coinmarketcal
var getToken = () => {
    return new Promise((resolve, reject) => {
        var tokenUrl = `${authEndpoint}?grant_type=client_credentials&client_id=${coinmarketcal_client_id}&client_secret=${coinmarketcal_client_secret}`;
        request.get(tokenUrl, (err, res, body) => {
            if (err) reject(err);
            resolve(body);
        });
    });
}

// Grabs the latest events
var getEventList = (token) => {
    return new Promise((resolve, reject) => {
        var listUrl = `${listEndpoint}?access_token=${token}&page=1&max=${maxEventCount}`;
        request.get(listUrl, (err, res, body) => {
            if (err) reject(err);
            resolve(body)
        });
    });
}

// This picks off all the stuff to use in the bots messsage
var refine = (list) => {
    return new Promise((resolve, reject) => {
        if (list.length < maxEventCount || list.length > maxEventCount) reject('Event list count error');
        var refinedArray = [];
        var obj = {};
        for (var i = 0; i < list.length;i++) {
            obj = {
                // Some other interesting object data that could be used in the future here!
                name: list[i].coins[0].name,
                symbol: list[i].coins[0].symbol,
                date: list[i].date_event,
                news: list[i].description,
                proof: list[i].proof, //<-- These seem to be images of the post. Could include them, but the embed will get rather large
                voteCount: list[i].positive_vote_count
            }
            refinedArray.push(obj);
        }
        resolve(refinedArray);
    });
}

// The discord embed constructor function
// Discord seems to cut any attempt at a newline if there is nothing or only whitespace after it.
var constructMessage = (result) => {
    msgFields = [];
    for (var i = 0; i < maxEventCount; i++) {
        if (result[i].news === null) result[i].news = 'No Additional Information';
        msgFields.push({
            name: `${result[i].name} (${result[i].symbol}) - ${result[i].date.substring(0,10)}`,
            value: `${result[i].news} \n   Vote count: ${result[i].voteCount}`
        });
    }
    return msgFields;
}

// You can probably guess what this one does
var sendMessage = (msg) => {
    return new Promise((resolve, reject) => {
        client.channels.get(chanId).send({embed: {
            // The colour is the decimal version of a hex colour code
            color: 9100084,
            title: "Upcoming crypto related events",
            url: "https://coinmarketcal.com/",
            fields: msg
        }});
        // This logs the post time to a global variable for the auto post timer
        lastPosted = Math.floor(new Date().getTime() / 1000);
        console.log(`Posted at ${lastPosted}`);
        resolve();
    });
}

// This is the main function when the call is invoked
var eventsMessage = () => {
    return new Promise((resolve, reject) => {
        getToken()
            .then(tokenData => getEventList(JSON.parse(tokenData).access_token))
            .then(list => refine(JSON.parse(list)))
            .then(refinedList => constructMessage(refinedList))
            .then(message => sendMessage(message))
            .then(res => resolve())
            .catch((err) => reject(err))
    });
}

// Discord listeners
client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}! = ${client.user.id}`);
    client.user.setActivity(`Calendar`);
    setInterval(function() {
        var now = Math.floor(new Date().getTime() / 1000);
        if (timeOut !== 0 && now >= lastPosted + timeOut) {
            eventsMessage();
            console.log("Timeout hit. Posting...");
        }
    }, 30000);
});

client.on('message', msg => {
    if (msg.channel.id === chanId) {
        if (msg.content.startsWith(bot_command)) {
            eventsMessage();
        }
    }
});

client.login(bot_token);