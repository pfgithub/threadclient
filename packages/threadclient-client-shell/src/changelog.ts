// TODO: import() this file with a linked loader

import { rt } from "api-types-generic";
import { autoPost, changelogEntry } from "./shell_client";

export const changelog2 = () => autoPost({
    parent: "/changelog",
    replies: [],
}, changelogEntry({
    title: "@TBD@ (search this to fix all)",

    notes: [
        rt.p(rt.txt("This update took place over @TBD@(generate) days and contains @TBD@(generate) "
        +"commits, @TBD@(generate) of which make user-facing changes.")),
        // ^ it would be cool to do time tracking so I could say how many hours went into updates
        // just make a vscode extension that marks every session (eg if you have typed in the last n minutes)
        // - this isn't perfectly accurate as it might exclude some time looking stuff up but it should be
        // pretty good. something like at least two edits in 5 min and then it tracks until you haven't
        // made an edit for 10min or something. couldn't find an extension to do this automatically

        rt.p(rt.txt("The bulk of the work in this update has gone towards getting the new page2 version "
        +"of ThreadClient ready to use, meaning that there are not very many new features or "
        +"improvements. Page2 is not ready yet, but you can try out the current progress "
        +"@TBD@(explain how).")),
    ],

    merge: {
        "55f1de809e992101e64ad1098094e2993367644d": {},
        "2f00a83097e84960399ff0587babab15292954ec": {},
        "51761eb0049c85837253141d6770d1dc74cd7e03": {
            previews: [
                rt.ili(rt.txt("Fixes a bug on the WIP new landing page with the feature cards")),
            ],
        },
        "714d227094e8760c0dece3e74cb931d7b8fc76a5": {
            previews: [
                rt.ili(rt.txt("In page2, adds collapse buttons to posts that don't have a voting action")),
            ],
        },
        "16776260d13f024422aad48c3e39638f91d227d6": {
            changes: [
                rt.ili(rt.txt("Renames the 'Open Links' setting to 'External Links'")),
            ],
        },
        [[
            // wow it takes a lot of commits to introduce abug
            "116b9cf75ad152bc66fe300d6b1c9ffd44f504c4",
            "e370adff386b25efd122a5d394e6fcf5822d893b",
            "617c3ffa2273a44e4dc3ac237c8d27cf737b4e7d",
            "86b636ad9787e215eb427ea1a7904a54ec709352",
            "c9af83ca8c9e39c54430ed26a9593b9346cfb253",
            "cf84699044062ba3a192f2d83d13b07c6464c9f9",
            "4c31ab57255b024a95a53cd0cf970ea1e8eec742",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("In page2, introduces a bug where collapsing a post by using the keyboard "
                +"to press enter on the collapse button causes your focus to be lost. TODO: fix this")),
            ],
        },
        [[
            "38add49dcdfcb956280067c3847cc75e9e7fc1bf",
            "16e4682caa22580783ebe955f95a45ceb8eb60a0",
            "8f630667c32cec39d77d87ced1354a7277fa77fe",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("In page2, breaks height animation on posts. Now, the post will animate but "
                +"the position of stuff below it won't. TODO: restore full animation on posts including "
                +"any items being collapsed below them."))
            ],
        },
        [[
            "c8a41f11ea589ec1661aabcc336ed412f4708894",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("In page2, temp-workarounds a bug where a collapse button will show but "
                +"does nothing in a post's dropdown menu. TODO: fully fix this when we add more types "
                +"of actions, as this also hides the collapse button on pivoted posts which are collapsible."))
            ],
        },
        [[
            "7aed871957d451e83875861a0b733c42cf08f3f5",
            "0c377b4f6f6962e4c58a4fb475a7f6f3d1302211",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Introduces a bug where the showanimate in settings doesn't work quite right"))
            ],
        },
        "0f865a160237f281086e4368f278c2818c8fa980": {},
        "62c8337e421ff2038b4b6dd71d83176bdc81bb8e": {
            bugfixes: [
                rt.ili(rt.txt("Fixes a bug where some elements will flash when you switch to dark mode")),
            ],
        },
        [[
            // my god
            "9c269a1f6c8b2bb22505708ac9468c1104a85c36",
            "ebad2dc233b51988a9c53de2eb1fc87bb19c67db",
            "34d5d17a484490bb3927a8978109575b4fa9acc2",
            "638e4ab3ec62e42044077517de907ac6b6454003",
            "9864c2ab2832e29df409f31ba189eff6eefd8e1c",
            "09c4f8a195d91f78380ab5db3430df6f8d502368",
            "b51317c376559733e3189685e58299eae412cfb4",
            "3c9eed56f5f0cb029dcbe492313d6191105b0262",
            "3ac92fab3905b5ec1e55e045c01903763aa8f470",
            "8cb4557706cba7d31a9e36093568dac2b7ade7d5",
            "57b76f30677de47661ca3ca39b88fe8e49a088e0",
            "25c16bc4351052376d9ef78f51d8d7df92371ff6",
            "d31def39353a65d8e7c6bec0d21480de2bf031e6",
            "0c5f990e4718b0c17f940253e15a543e62df50b4",
            "1d53c93459f53d200e3df606b133fb50e8f276be",
            "bfd02267bad841ed096ea3c1b63c2ef5ec8084b6",
            "5d9a2280ff941ac851b569a0a107f14ebc1c18d7",
            "89fe04525083c3125440078894ec72317d477dea",

        ].join(",")]: {
            previews: [
                rt.ili(rt.txt("Improves how clickable page2 posts look. It looks fancy. @TBD@ link demo")),
            ],
        },
        [[
            "0411ca03ba5cbdfc7141ffb9116b6382426556fb",
            "91b87c809d2e29648a3faac5f515bd33d94e671f",
            "eaee5327dbe0f5264750b79979095adfeb6c903b",
            "ca00f870c691ef78816b3f77fede9212d3477109",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Improves how sidebars are shown on mobile in page2")),
            ],
        },
        [[
            "f658127db737009a1a378ff248bae6b248e66a5c",
            "650d9cfa1f84062a4a505505bdf909b5a84e40b7",
            "986b0e4539e37f46804970bdc2dc8ed906e3b61a",
            "f4c604ce2df7b0074c78bca0452438703ee3d58c",
            "db019e53510ed725943800cb78e16adf75bf61f3",
            "65fcb8d038764968b45c96f72008154c9b1ea75e",
            "683c6f92c4fb6a992e7ba3b6bf5735c2b5109a5e",
            "24f383c149816e9969ed2a65dbe2707f397a5deb",
            "ece7eaf75cf7a94dfb1a1ba739cf400c7ef881ef",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Feature parity and improvements over page2 sidebars")),
            ],
        },
        [[
            "883d0e0cab394e660308c2288db3d09d3307e541",
            "9745b8134fbdcc5e1e0253b2f5aca25d73a6aeef",
            "2d47e12a941cb89881d855a4e85273cc370377c3",
            "dfcf31ace052ebf54504a03807bbd0ac523ba21f",
        ].join(",")]: {
            changes: [
                rt.ili(rt.txt("Improves the look of the post reply editor. @TBD@ see about improving preview too")),
            ],
        },
        [[
            "ead9d1bd7d911e115b079fc262d4956ae7022038",
        ].join(",")]: {
            bugfixes: [
                rt.ili(rt.txt("Fixes a bug where the 'new update' banner is shown to first-time users")),
            ],
        },
        [[
            "5753b6c013df6297ec786354f60cb247dbc7595e",
            "fe527e9cc15610ee73916c50ba46fd8513e89835",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Initial support for offline ThreadClient development (*: no images yet)")),
            ],
        },
        [[
            "c67a4ec49d39134fdc25a8a5579e73fe5b300219",
            "80f080ab263b80abeaf30539369494c1a52f461d",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Make a page2 URL for sidebars: /r/sub/@sidebar")),
            ],
        },
        [[
            "7335aaa6b283ff1b77758b9011ee7314486e39b5",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Fixes a bug where some subreddits are missing sidebar icons. Although the same "
                +"bug also exists in page1 and fixing it would take less time than writing out this message, "
                +"it is not fixed in page1. @TBD@")),
            ],
        },
        [[
            "ab83f367e1b4d02f692db8803746211fdec6fe22",
        ].join(",")]: {
            changes: [
                rt.ili(rt.txt("Link helpers are now disabled by default, unless you are on a touchscreen. "
                +"Turn them back on in "+rt.link({id: ""}, "/settings", {}, rt.txt("Settings")))),
            ],
        },
        "2a562bb720b2e33dd1269b8fb5ece6dcf794b7a6": {},
        "14035ca5786083e83250582151320c76583ae7ec": {},
        "a2f52393ecb3c481245f062589334524c6d5e2fc": {},
        [[
            "a6c0dc1730e9727ac9b22645b084c10675af06b3",
            "64f0bbb446b904a889c92c291a8076f4b6b8c055",
            "fc91e58101f355a6ac284c6749b1e21408e8aab1",
            "e58c569c9cd66f971fcd8ccfacac9d28f940cf6a",
            "c747cab1072efccc49c7c6d5d0c2272697da4fe9",
            "72bd1dd36ece9b15c8bd121020760e59ba44a737",
            "5139d425c0787459ecc95197de2188557004e9c6",
            "81b95848e74e324930aa8490d250d5f05dff7f22",
            "ffb8d17d5883ca826e9bc0d6eab24440ad2bbbf1",
            "9a8c86e56413751fb182407261f0ed6c6584fb2e",
            "ad4abe45ad14c61e0b4f21bd5b2bb446d6c78661",
            "ecb2db2c3bafc125e06c303ab5ea296f1d387e6a",
            "5e300a32ef6e745931f8fb3351af302a28126015",
            "b991fa0be4b64f3ee166a0695c248183ebec4e61",
            "7e68c772c3d4eceb6863c3df09e08e90ed554b8d",
            "1110a07ac858f4dac4541ff90b2df9c1a562d254",
            "f0cd6f69ea0f66833668b3461f7afa89ae360368",
            "49f32adddd00accec1b023681f7e96b5c4c6edf5",
            "63ceebb955aaa6de9ea0902f1c54b0de9f4bd790",
            "7f215e05235b6e282e1a0546665314ba6603bc3b",
            "c823295b05bc5512b9a338775613b66e106378c3",
            "f77d50b58cb02c379f62ffa4d24398c2699524f9",
            "3684496fddb015695c6cf7c5b206143b1aa49ff8",
        ].join(",")]: {
            changes: [
                rt.ili(rt.txt("Completely breaks the Mastodon client. I hope no one was using this. @TBD@ "
                +"make sure at least the link on the homepage works before release")),
            ],
            internal: [
                rt.ili(rt.txt("Internally change how page2 loaders work. This adds support for loading parent "
                +"comments, something which page1 never supported, significantly simplifies writing clients "
                +"for page2, and opens the door for making an entirely serverside clients in the future.")),
            ],
        },
        [[
            "f182ffa683bf514eb6f9776d64d78ecc1979e3dc",
            "915b78a2a450caf75c543708436685395ad719ec",
        ].join("")]: {
            internal: [
                rt.ili(rt.txt("Adds a setting to show/hide internal code buttons. @TBD@ consider making this "
                +"work in page1 and marking this as a 'change' 'hides code buttons that do nothing'")),
            ],
        },
        "3da8707d43677b29eafc3b0025579e1b3540c56d": {},
        [[
            "9a72dc9d2bd7e7efcb95e37016d60ec405064b5f",
            "7ef5f3f7e77d1cc77b82c9db2cb2225470005a6e",
            "08074351dbd946747f186a62d06016fc64b6786a",
            "f92f1f4725a87ae871dec5dbf093c79b43215da3",
            "c6b5c073fe8179f4a482668d79d4cd3009455532",
            "bd54c07697d47be3c68f14162c37f54ea1fbe752",
        ].join(",")]: {
            // jsoneditor changes. no changelog needed.
        },
    },
}));

export const changelog1 = () => autoPost({
    parent: "/changelog",
    replies: [],
    // vv we could implement these as replies instead of just a richtext list
}, changelogEntry({
    title: "Apr 19, 2022 ThreadClient Update",

    changes: [
        rt.ili(rt.txt("Added a changelog and a banner when a new version is released. Disable in "),
            rt.link({id: ""}, "/settings", {}, rt.txt("Settings")),
        ),
        rt.ili(rt.txt("New colors - the background grays are a bit different. This improves contrast in dark "
        +"mode and makes the colors more consistent across the UI.")),
        rt.ili(rt.txt("Fancy new animated toggle switch in "),
            rt.link({id: ""}, "/settings", {}, rt.txt("Settings")),
        ),
        rt.ili(rt.txt("Updates the focus outline color to be more visible when tabbing through elements")),
    ],
    bugfixes: [
        rt.ili(rt.txt("Fixed headers not having the gradient")),
        rt.ili(rt.txt("Fixed unnecessary reloads when using the browser url bar to navigate to a new page")),
        rt.ili(rt.txt("Fixes flairs so the text should always be readable")),
    ],
    previews: [
        rt.ili(
            rt.txt("Started work on a new landing page for ThreadClient. You can see it at "),
            rt.link({id: "shell"}, "/", {}, rt.txt("https://thread.pfg.pw/#shell")),
        ),
        rt.ili(
            rt.txt("Updated title links in page2 to act as a repivot rather than a full reload"),
        ),
        rt.ili(rt.txt("Set titles of some page2 pages now")),
    ],
}));