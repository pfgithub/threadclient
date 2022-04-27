/* eslint-disable */
import { Account, Instance } from "./mastodon";

const tests: Instance[] = [
  // https://mastodon.social/api/v1/instance
  {"uri":"mastodon.social","title":"Mastodon","short_description":"Server run by the main developers of the project \u003cimg draggable=\"false\" alt=\"🐘\" class=\"emojione\" src=\"https://mastodon.social/emoji/1f418.svg\" /\u003e It is not focused on any particular niche interest - everyone is welcome as long as you follow our code of conduct!","description":"Server run by the main developers of the project \u003cimg draggable=\"false\" alt=\"🐘\" class=\"emojione\" src=\"https://mastodon.social/emoji/1f418.svg\" /\u003e It is not focused on any particular niche interest - everyone is welcome as long as you follow our code of conduct!","email":"staff@mastodon.social","version":"3.5.1","urls":{"streaming_api":"wss://mastodon.social"},"stats":{"user_count":677600,"status_count":35477609,"domain_count":22753},"thumbnail":"https://files.mastodon.social/site_uploads/files/000/000/001/original/vlcsnap-2018-08-27-16h43m11s127.png","languages":["en"],"registrations":false,"approval_required":false,"invites_enabled":true,"configuration":{"statuses":{"max_characters":500,"max_media_attachments":4,"characters_reserved_per_url":23},"media_attachments":{"supported_mime_types":["image/jpeg","image/png","image/gif","video/webm","video/mp4","video/quicktime","video/ogg","audio/wave","audio/wav","audio/x-wav","audio/x-pn-wave","audio/ogg","audio/vorbis","audio/mpeg","audio/mp3","audio/webm","audio/flac","audio/aac","audio/m4a","audio/x-m4a","audio/mp4","audio/3gpp","video/x-ms-asf"],"image_size_limit":10485760,"image_matrix_limit":16777216,"video_size_limit":41943040,"video_frame_rate_limit":60,"video_matrix_limit":2304000},"polls":{"max_options":4,"max_characters_per_option":50,"min_expiration":300,"max_expiration":2629746}},"contact_account":{"id":"1","username":"Gargron","acct":"Gargron","display_name":"Eugen","locked":false,"bot":false,"discoverable":true,"group":false,"created_at":"2016-03-16T00:00:00.000Z","note":"\u003cp\u003eFounder, CEO and lead developer \u003cspan class=\"h-card\"\u003e\u003ca href=\"https://mastodon.social/@Mastodon\" class=\"u-url mention\"\u003e@\u003cspan\u003eMastodon\u003c/span\u003e\u003c/a\u003e\u003c/span\u003e, Germany.\u003c/p\u003e","url":"https://mastodon.social/@Gargron","avatar":"https://files.mastodon.social/accounts/avatars/000/000/001/original/ccb05a778962e171.png","avatar_static":"https://files.mastodon.social/accounts/avatars/000/000/001/original/ccb05a778962e171.png","header":"https://files.mastodon.social/accounts/headers/000/000/001/original/3b91c9965d00888b.jpeg","header_static":"https://files.mastodon.social/accounts/headers/000/000/001/original/3b91c9965d00888b.jpeg","followers_count":106778,"following_count":281,"statuses_count":72272,"last_status_at":"2022-04-26","emojis":[],"fields":[{"name":"Patreon","value":"\u003ca href=\"https://www.patreon.com/mastodon\" target=\"_blank\" rel=\"nofollow noopener noreferrer me\"\u003e\u003cspan class=\"invisible\"\u003ehttps://www.\u003c/span\u003e\u003cspan class=\"\"\u003epatreon.com/mastodon\u003c/span\u003e\u003cspan class=\"invisible\"\u003e\u003c/span\u003e\u003c/a\u003e","verified_at":null}]},"rules":[{"id":"1","text":"Sexually explicit or violent media must be marked as sensitive when posting"},{"id":"2","text":"No racism, sexism, homophobia, transphobia, xenophobia, or casteism"},{"id":"3","text":"No incitement of violence or promotion of violent ideologies"},{"id":"4","text":"No harassment, dogpiling or doxxing of other users"},{"id":"5","text":"No content illegal in Germany"},{"id":"7","text":"Do not share intentionally false or misleading information"}]},
  // https://mastodon.lol/api/v1/instance
  {"uri":"mastodon.lol","title":"Mastodon.lol","short_description":"A Mastodon server friendly towards anti-fascists, members of the LGBTQ+ community, hackers, and the like.","description":"A Mastodon server friendly towards anti-fascists, members of the LGBTQ+ community, hackers, and the like.","email":"support@mastodon.lol","version":"3.5.1","urls":{"streaming_api":"wss://mastodon.lol"},"stats":{"user_count":5465,"status_count":86145,"domain_count":5864},"thumbnail":"https://mastodon.lol/system/site_uploads/files/000/000/001/original/preview-9a17d32fc48369e8ccd910a75260e67d.jpg","languages":["en"],"registrations":true,"approval_required":false,"invites_enabled":false,"configuration":{"statuses":{"max_characters":500,"max_media_attachments":4,"characters_reserved_per_url":23},"media_attachments":{"supported_mime_types":["image/jpeg","image/png","image/gif","video/webm","video/mp4","video/quicktime","video/ogg","audio/wave","audio/wav","audio/x-wav","audio/x-pn-wave","audio/ogg","audio/vorbis","audio/mpeg","audio/mp3","audio/webm","audio/flac","audio/aac","audio/m4a","audio/x-m4a","audio/mp4","audio/3gpp","video/x-ms-asf"],"image_size_limit":10485760,"image_matrix_limit":16777216,"video_size_limit":41943040,"video_frame_rate_limit":60,"video_matrix_limit":2304000},"polls":{"max_options":4,"max_characters_per_option":50,"min_expiration":300,"max_expiration":2629746}},"contact_account":{"id":"1","username":"nathan","acct":"nathan","display_name":"Nathan 🏳️‍🌈","locked":false,"bot":false,"discoverable":true,"group":false,"created_at":"2020-06-04T00:00:00.000Z","note":"\u003cp\u003e⚙️ Mastodon.lol admin\u003c/p\u003e\u003cp\u003e🏳️‍🌈 Pan cis guy\u003c/p\u003e\u003cp\u003e🐕 Send me photos of you dog\u003c/p\u003e","url":"https://mastodon.lol/@nathan","avatar":"https://mastodon.lol/system/accounts/avatars/000/000/001/original/1acd35410cb98187.png","avatar_static":"https://mastodon.lol/system/accounts/avatars/000/000/001/original/1acd35410cb98187.png","header":"https://mastodon.lol/system/accounts/headers/000/000/001/original/67608750ad6b0645.jpeg","header_static":"https://mastodon.lol/system/accounts/headers/000/000/001/original/67608750ad6b0645.jpeg","followers_count":2609,"following_count":28,"statuses_count":1064,"last_status_at":"2022-04-26","emojis":[],"fields":[{"name":"Pronouns","value":"He/him","verified_at":null},{"name":"Gay","value":"Very","verified_at":null},{"name":"Shit","value":"Posting","verified_at":null}]},"rules":[{"id":"1","text":"No hate speech/discrimination/etc"},{"id":"2","text":"No oppressive language or actions"},{"id":"3","text":"No harassment/stalking"},{"id":"4","text":"NSFW content (including nudity) is permitted so long as it's marked as sensitive and behind a content warning"},{"id":"5","text":"No gore or graphic violence"},{"id":"6","text":"Respect peoples' pronouns"},{"id":"7","text":"No sexual depictions of children"},{"id":"8","text":"No automated spam (friendly bots ok)"},{"id":"9","text":"No doxxing"},{"id":"10","text":"No begging for money (giving people the option to donate is totally fine)"},{"id":"11","text":"Accounts created solely for the purpose of posting pornographic content are not permitted unless it's your own content"}]},
];

const account_test: Account = {
  "id": "23634",
  "username": "noiob",
  "acct": "noiob@awoo.space",
  "display_name": "ikea shark fan account",
  "locked": false,
  "bot": false,
  "discoverable": false,
  "group": false,
  "created_at": "2017-02-08T02:00:53.274Z",
  "note": "<p>:ms_rainbow_flag:​ :ms_bisexual_flagweb:​ :ms_nonbinary_flag:​ <a href=\"https://awoo.space/tags/awoo\" class=\"mention hashtag\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">#<span>awoo</span}.space <a href=\"https://awoo.space/tags/admin\" class=\"mention hashtag\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">#<span>admin</span} ~ <a href=\"https://awoo.space/tags/bi\" class=\"mention hashtag\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">#<span>bi</span} ~ <a href=\"https://awoo.space/tags/nonbinary\" class=\"mention hashtag\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">#<span>nonbinary</span} ~ compsci student ~ likes video <a href=\"https://awoo.space/tags/games\" class=\"mention hashtag\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">#<span>games</span} and weird/ old electronics and will post obsessively about both ~ avatar by <span class=\"h-card\"><a href=\"https://weirder.earth/@dzuk\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>dzuk</span}</span></p>",
  "url": "https://awoo.space/@noiob",
  "avatar": "https://files.mastodon.social/accounts/avatars/000/023/634/original/6ca8804dc46800ad.png",
  "avatar_static": "https://files.mastodon.social/accounts/avatars/000/023/634/original/6ca8804dc46800ad.png",
  "header": "https://files.mastodon.social/accounts/headers/000/023/634/original/256eb8d7ac40f49a.png",
  "header_static": "https://files.mastodon.social/accounts/headers/000/023/634/original/256eb8d7ac40f49a.png",
  "followers_count": 547,
  "following_count": 404,
  "statuses_count": 28468,
  "last_status_at": "2019-11-17T00:02:23.693Z",
  "emojis": [
    {
      "shortcode": "ms_rainbow_flag",
      "url": "https://files.mastodon.social/custom_emojis/images/000/028/691/original/6de008d6281f4f59.png",
      "static_url": "https://files.mastodon.social/custom_emojis/images/000/028/691/static/6de008d6281f4f59.png",
      "visible_in_picker": true
    },
    {
      "shortcode": "ms_bisexual_flag",
      "url": "https://files.mastodon.social/custom_emojis/images/000/050/744/original/02f94a5fca7eaf78.png",
      "static_url": "https://files.mastodon.social/custom_emojis/images/000/050/744/static/02f94a5fca7eaf78.png",
      "visible_in_picker": true
    },
    {
      "shortcode": "ms_nonbinary_flag",
      "url": "https://files.mastodon.social/custom_emojis/images/000/105/099/original/8106088bd4782072.png",
      "static_url": "https://files.mastodon.social/custom_emojis/images/000/105/099/static/8106088bd4782072.png",
      "visible_in_picker": true
    }
  ],
  "fields": [
    {
      "name": "Pronouns",
      "value": "they/them",
      "verified_at": null
    },
    {
      "name": "Alt",
      "value": "<span class=\"h-card\"><a href=\"https://cybre.space/@noiob\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>noiob</span}</span>",
      "verified_at": null
    },
    {
      "name": "Bots",
      "value": "<span class=\"h-card\"><a href=\"https://botsin.space/@darksouls\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>darksouls</span}</span>, <span class=\"h-card\"><a href=\"https://botsin.space/@nierautomata\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>nierautomata</span}</span>, <span class=\"h-card\"><a href=\"https://mastodon.social/@fedi\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>fedi</span}</span>, code for <span class=\"h-card\"><a href=\"https://botsin.space/@awoobot\" class=\"u-url mention\" rel=\"nofollow noopener noreferrer\" target=\"_blank\">@<span>awoobot</span}</span>",
      "verified_at": null
    },
    {
      "name": "Website",
      "value": "<a href=\"http://shork.xyz\" rel=\"nofollow noopener noreferrer\" target=\"_blank\"><span class=\"invisible\">http://</span><span class=\"\">shork.xyz</span><span class=\"invisible\"></span}",
      "verified_at": "2019-11-10T10:31:10.744+00:00"
    }
  ]
};  