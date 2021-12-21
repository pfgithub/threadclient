// import browser from "webextension-polyfill";

// https://bugzilla.mozilla.org/show_bug.cgi?id=1319168
// need both a background and a content script because this isn't implemented :(

// so:
// - in the content script, we need to add a sendMessage listener
// - make sure this only functions on thread.pfg.pw
// - we need to have that ready before thread.pfg.pw sends a request.
//   (maybe it can delay a little bit just in case / exponential backoff)
// - we need to acknowledge the request as soon as we get it
// - we need to then send the request to the background script
// - the background script needs to send the request to reddit, or error
//   if we don't have a token
// - the content script needs to send that result back to the website
// - the website needs to choose what to display based on the result (eg
//   show an error | show the value)

// - if the website knows the extension is installed, it should send all of
//   its indicator requests through the extension
// - the gql api for the request "9d105ce5d71a" gives back
//   {
//     "data": {
//       "badgeIndicators": {
//         "messageTab": {
//           "count": 0,
//           "style": "NUMBERED"
//         },
//         "activityTab": {
//           "count": 0,
//           "style": "NUMBERED"
//         },
//         "inboxTab": {
//           "count": 0,
//           "style": "NUMBERED"
//         },
//         "chatUnreadMessages": {
//           "count": 0,
//           "style": "NUMBERED"
//         },
//         "chatUnreadMentions": {
//           "count": 0,
//           "style": "NUMBERED"
//         },
//         "chatHasNewMessages": {
//           "isShowing": false,
//           "style": "FILLED"
//         },
//         "chatUnacceptedInvites": {
//           "count": 0,
//           "style": "NUMBERED"
//         }
//       }
//     }
//   }
// - much fancier than the one old.reddit uses, although this one is probably
//   subject to more change (change means the api would stop working eventually,
//   since this is gql the actual response data won't change for a given request id.)

// or use d99f8962bcd6
// that's the old.reddit one which is probably less likely to change

// await fetch("https://gql.reddit.com/?request_timestamp="+Date.now(), {
//  method: "POST",
//  headers: {
//    "Content-Type": "application/json",
//  },
//  body: JSON.stringify({
//    id: "9d105ce5d71a",
//  }),
// }).then(r => r.json())