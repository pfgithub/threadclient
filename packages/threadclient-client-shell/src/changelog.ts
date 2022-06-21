// TODO: import() this file with a linked loader

import { rt } from "api-types-generic";
import { autoPost, changelogEntry } from "./shell_client";

// const ntxt = git rev-list `${COMMIT-HASH}..HEAD`;
// const mtxt = (this file)
// copy(ntxt.split("\n").map(l => mtxt.includes(l) ? "[✓] " + l : "[✗] " + l).join("\n"))

export function changelog2() {return autoPost({
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
                rt.ili(rt.txt("Introduces a bug where when clicking 'show anyway' in settings, the animation is wrong"))
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
            "1cde2e6dd2f3c1d7a1ea6ded04d46e08e2b53f0b",
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
            "36cce8aa00db36dfd97152170b5d5dc3a6c5d0ac",
            "6c1079407341ef24b98fd6c05d778f2405960be2",
            "26eb599656683fdb8e5c3057547d7cb9d601f9be",
            "d27beabf3889442fcfd2fd171296c9926a0a0e22",
            "caf459cf337f5967ec125331e2b09240fdbfc5d6",
            "1bdd6c0fe78716ecca195fb7a91f475a5381eb65",
            "793d30122f440c0bef87599fe41bf457730aea6f",
            "62749bfb013b11aa882c597e6a099b6f56357d07",
            "a669ec16e1982870401f715a039ec8483914d122",
            "e9962f9f2674341600034c75a4ae967af7ac85a2",
            "be2d9f846a42990fc3bc5650064b648f58c59b4e",
            "438265fa2215dc0203497c51791898ed16521436",
            "0e1e3249cdc427201b5e7bcfe9a604c61d91e3d2",
            "c128d336a6c9f23f46d56926c8409bd9bc826532",
            "3180e6b1f9c0902a892da3c8d86ad5287147773d",
            "ad8bb44f2e3a6594d86c1137911606030f38d114",
            "121f45fabeea57dc004e50f988ca6d19940f50a4",
            "6ce3f1cf47afdcb135a6fb3394870b5ea2b4ff45",
            "6b72d37718cb9a8e24d23043776ace4a46beefe4",
            "37c72f4869e878bf38e296e514423a60b6266c8b",
            "2dafc24587f740c72a1d1f38902b652fe6f0bafb",
            "23eb6ab416b98fa32016ddc6cc2432415a117855",
            "5f52bcf2b48afc58286ae6b08edffe4be6a479a4",
            "eb0ba2893550f04459c46adf7391e5c9b987a7dc",
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
            "49d931f82db359b653b87f85262f8614b7f07f2b",
            "d4c8c6e711b4ae5add117573ce820a97c0b5a8fe",
            "1be9ffa1cefae16c9248f32ac1c9d3485dc22cf1",
            "46d1735759101865059be90f665c7d14c68f69f5",
            "5a8ac286e1a5b2199b7d8eb0f5714591fd68f3c0",
            "e79d991ee539a2c0b2f4a3e022357f0a2100a7e6",
            "3d9ea9ce88a1db0ddb1206154a136e0e1fa1c9b5",
            "24444e5321123f861df7a4cc34fb853ad67eab99",
            "d562bdd75e3986a13677d221f830bee8fd1dd204",
            "c1b95bf777864af2fa351f62ab6261551539ea60",
            "d3672f0f037c134313440acf70259cb6313b52be",
            "d5459f45d987e5385e784a11e795e5e468606148",
            "6b1a19c0fd0d4dbbcc3f3a133902d6468bc573db",
            "1253235ad5cb30bf9f72fbbc744c408756e486e7",
            "09308ef2cc4b3f72d6b21c7d9ab385996bf1c898",
            "633ab0d09fe5f0799ad4768e5144b6ac6de3a2ba",
            "693362e8bac6a27fb42225ff34b55cef81a3fc50",
            "5b49710098b72e273d71d3a6dde19bddef0e88d4",
            "33bd3eccf98499c3443ba9d8fb18e299737e0ea2",
            "5ebc599ed80c64a8a20a0cfc8bccc5c149b60283",
            "6123b4efa291f30787d3da38e90ad90930669e47",
            "5c83663a2fbfd612937332dad63b61a7187e3c53",
            "1ce8271d5ec710feb78ec9d36bfb0f444109140d",
            "8be4727e60ca26d3c3604cb7699a337c0211032f",
            "3fff908be30b03c71295355fc707934a27122438",
            "52207480ddeaaced4e22a64ca09a4e43d7c6e61d",
        ].join(",")]: {
            // jsoneditor changes. no changelog needed.
        },
        [[
            "55aa5b2be5f82d7f970db243e6ecd1558c6db9b3",
            "94d539de68ae11d70bc298856cc842ed69c524b0",
            "8babb8c9eda7c85b16088f139436886939a1ee6e",
            "b3de0b4f7eb4acf488b421ff9fd5544d27d7348d",
            "db408e6a3aac2649e0f41951141d19c9191f1ea7",
            "07863b9d4dce73c038ceb5cbbc5f3920671d2d51",
            "62e0d89aaa87fc5430d4b1ef2b6239cac9fbf463",
            "71a160d2b01c750993cbeb202995cdbc6aa673c8",
            "0bf457d8bdc2d0f7829a40eeae2e9abf9ed77ff9",
            "926ee23025e23eb3c40049ee803373077e8c97d7",
            "783b47a3ce6312298b62b516baa4dd8563bc498a",
            "db0ca10eadff8a8e89c0b04608d621e092d7cc3f",
            "b8de729846623371cd49797b3a0cc685e86af7d5",
            "37f7d855f43c1a2b8981beac51ee07629414c77f",
            "94fddebea2f33ba967472931ca8ba1c5e925786d",
            "be8bef39cddb4dc3d35d6743bf301db5cb1bf1f4",
            "21349a04ef34bbf67c6a78e9c97bab2658b56936",
            "6ad56f99439ca67336068c3e3cf603ca379820e3",
            "28acf55c38874a944c851870cdc8a272a8a287f3",
            "36ccab955a3926bfe1481595ef259364d748c844",
            "12113a65a5cf430bed8e32561b35ca8131c07b41",
            "b2845134936cb88f259812b0c9aefbc51dd16973",
            "892607ed9f547ea35fa98d7bdeae0b8e983f8742",
            "2fd9028941b0f781e7366cda923e0227ec0ba1a1",
            "3e13de4fa8258e6bfbcefc02b430c18055a6de2b",
            "d9c53813409f4ccf671ef75210ecb72119ac8afa",
            "fc5c7c709ca40ea19a675ada645186984c131224",
            "18177ce161cfdf18e93118d8cc5c3415b553bb5d",
            "7719e122487d0216343fc4f749d4f43d36e5f9cb",
            "ee68fe9635e44182cdfdc0739e1154005eccf38a",
            "cb83be91d49d37b865c216b59739b84f6f69e41a",
            "918daf3b3baa9f106f920990ed173e10e8acf020",
            "d1b7b292fa2b815f548fa7643ff94d52556fca28",
            "36eb6fa11adc8805fdd92d9af9a62d499f212be2",
            "ccefd21a39012a71c30a67bca982a03789da02e0",
            "35f5030ea2ce602a198cb5897f54f0ff49032287",
        ].join(",")]: {
            // termapp/canvasui changes, no changelog needed.
        },
        [[
            "40e3a37cc2e0e9caeb7c8a11d37f3752a54ad044",
            "46ad15bd1ca731527db158c5d220b0fadc7fe182",
            "d734e6e0782935c4e4181a51093b5e336005d72d",
        ].join(",")]: {
            // refactoring or lint fixing, no user-facing changes
        },
        [[
            "a05a2de246f42e49d4f1c4ed35504c47865cd20e",
            "c2b76252b8ce441167c442efa37298253f45f141",
            "7de69742b078be48ff9fb3798be37fdf991ba260",
            "3274abda6d0cfae49650e06aaae7861154cd5690",
            "58de34e6a59da6d9aa4260f6b8c8bdf6e4943e74",
            "7b1e38fb8b4710e52972956a8205e4b9407bfb80",
            "18c7a4183f00c540ed04baad98fd7530c161186c",
            "4a7aa0bfd0e3b86f83f1dc8f7e875d5ed8c93aa7",
            "13edda915c8e66472d967d2b7e4c5f78cc291d4c",
            "151d16e1d582a894c35eede23eac1e293ceae5cd",
            "2d4a002e6696e9572887486ce2256b1cbd6c914f",
            "d3656d416353dfe52555df49eafa62b05eb22f9b",
            "6055f4c63d282e206153a83aa78e908f3c4b8be3",
            "8a46bfd7cf5ad9d5470e9992534ce4ac8c497f71",
        ].join(",")]: {
            // planning, no user-facing changes.
        },
        [[
            "1791fb4edfb932ad1459330d52f278865246afd7",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Improvements to the page2 data structure")),
            ],
        },
        "49c0b5d6604bd99b2d2f4379a89208942ca37cac": {},
        [[
            "5753b6c013df6297ec786354f60cb247dbc7595e",
            "fe527e9cc15610ee73916c50ba46fd8513e89835",
            "9c635d56891e7941f7be2b8a39f20adb53bf1d14",
            "d94c59ae311664350fd2f267d8e1df8e5e172696",
            "df3078534117d7b231005960d7a3260246c24f9b",
            "3257b2b79f278412fee3f9cbce29fc5425e524e0",
            "949eb3a340a685653438a109cd1d73d0dc586f34",
            "edc0fe7784fb0535173569d3fc977b55fe603044",
            "df603ee2d77d6e09ffe2e2ec588fbd0de45e4515",
            "dcf5ac36b807bc94e5575205032659dc7ae6ac6a",
            "259d4bbee4ce6b7fe1b7f5989538cd9e8336f8d7",
            "b62ae1028e0e8927dc439882aef2c2cbeb4cbc95",
            "3d0b88be9d8d7fe004f4111747df0138ef339a01",
            "4b0f5b8421b5de2b06ad17a2e5ebb34ea486fb55",
            "d7400f4380d7b6d13d73648eaec3fdacdc1f5d94",
            "aa33bcc1142e62165ca36c85d6dede1d2dc7cb06",
            "b19057526f0e1f70c0fa0d35611bcb078cb49e39",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Creates a new tool that allows developing ThreadClient while offline")),
            ],
        },
        [[
            "6b86778e48ea06be73dcf9013f19fc3f37f1ac06",
            "9b4f8c422f9036a880676e915af54654dd11111d",
            "17b1186099a28f5e3f4bcc09229f2b33549e4357",
            "b2130e5823ecc062651bfd0f703bdbd5dcfb624a",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Write the changelog")),
            ],
        },
        [[
            "3cb4a31bab1fb8d6a3a8b7efba2fb0b478ef58f6",
            "0f356db31e7dfa51cad216b8800895aa5b9974ac",
            "587b8400cf9a9f76f0ea7b8629c40b77d2ea81ad",
            "9db00f9dda3f61fc04761ba412c60237d03df81f",
            "49d1f3f6cda97b970e759d10354dbcb65e230cb6",
            "e4334d31cfabdaa999d6de539c1598802d8031a4",
            "a6c9a0ed1f838a5697d9d32d0d58404ad494d5c2",
            "e2706280b42dd68e4454b6a1d2aea4872395fa36",
            "0d6137e99cd6c5c2b9bda31ded67e61058bd70c5",
            "217756971ea51fabbe3e532f653c972951d93d35",
            "659a37b913fda9a95b06153d3e6d5ef385252bc7",
            "4c3be8d3e66f0896d8a93dcc7d61907645e7f989",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Start to support sorting in page2")),
            ],
        },
        [[
            "9d1affe82d1691dac09686eb31b6cd00c454f2bf",
            "b92e5f6e4407c35d594809aa952d42c228330306",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Add post hover effects in page2"))
            ],
        },
        [[
            "b9c368c2c143a34a209ec16ff6b61be390137965",
            "e97dd8a4e0abc7653f239588cc342f6137804589",
            "0ec9ef619ac2672f26a002a841071e4442d1a657",
            "43893b75e46787e79b6e0068b84644290ee29d30",
            "9ee5a52cc96866f10542915fa414f31ae82aa801",
            "1cbaf847cb33d6f1fb40a854cfab54bd2879cf80",
            "68d92889bb6fb0d6528b0f6b123d7ff2e8127229",
            "fc840eb4d509af314474898b829158754cbec745",
            "28756749c9ecb27410a04970b1fdc851494c7eb5",
            "c37f383e7ca3771664f19dc664c8fb15b552f555",
            "4e7b23b781e97d21b6d8d04924dcd8db573238fa",
            "9426ed3aaf67a764a13d90a3a390ceeab66f0616",
            "c724ead7012efe20b3406b9fbcb8a09906399519",
            "1f3997ea5b244cf04fed0751a6184ebacee93763",
            "ca97dac8e7192d6254dc6097f0b4272ac7c4f0e2",
            "3ed23dd330e8d91e9ac38f5b7b984ba4c2c80d70",
            "a58462f4df19eb67a338ee919516d658c87d0a5c",
            "e2b88c6a578cc3c8d3c3f1539aaed0496d5b2daf",
            "17bf7b829ad2a4d41e502d81a59e4ddac67dcdbd",
            "c23d235a7152070e0c384d7c92ad0bbea2b477ab",
            "afc27a9077a342d2de77d1e88e7562591553fd71",
            "f95952503ff4a7af0329e3352005f269c636763e",
            "a36ff0f5cb1939b524e8d9e3d2e956bc954c6148",
        ].join(",")]: {
            previews: [
                rt.ili(
                    rt.txt("Started work on a new way of displaying feeds in ThreadClient inspired by the tik tok ui: "),
                    rt.link({id: "reddit"}, "/r/pics?--tc-view=fullscreen", {}, rt.txt("Try it on r/pics")),
                    // ^ consider prefering page2 if `--tc-view` is present in urlsearchparams
                ),
            ],
        },
        [[
            "b2d27de7f61ec75150d77c9be9cbb44fd3c65ed9",
            "02cda597e31e04c0b424069ad0682b31d4b8c974",
            "75be07051fe0b90e77b879fc0bf23760172ffe98",
            "7f19b20421927bb28ae8bd24d0907badaa783871",
        ].join(",")]: {
            previews: [
                rt.ili(
                    rt.txt("Started work on a new reader view for posts. Try it by clicking the 'Reader' button below this post"),
                ),
            ],
        },
        [[
            "223ebe87d567ed3c280b7c225ed25d39df0f3fee",
            "0407c71842ebed996ea7477a43d4e87ba66c6442",
            "863bcbec800fe856bd8ca45bae5f112251d9c3b5",
            "9efeb755884ffe9ef21d1db3d6d0105d6b3cec5e",
            "1d46b62fc1cf6a9c7b85677ec7602b0d153e37e0",
            "6953935b0cd73dc0d35498e805dc1e71df1e669a",
            "162281d915d63ca85f9884bb6a4062bddda3bcc3",
            "cbab1c3e1c77feff741da8af79c71a9a08d742e4",
            "8fe7342ad59a2caef3561569071a7c631d7e3583",
            "9eac4d145de1fcfa8be0d95ec9a8cd3d9c8334f5",
            "6d92857baa65363d44a049dd1cd331eb986a8b33",
            "1f4d25e307b856b1b500a2d5f11df30a32a1dde5",
            "5ad133e070394fedd4040359c41c3c3781eab6b3",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Improves page2 performance")),
            ],
        },
        [[
            "caec3f08c72e1dabf96511b94437efb8be5fcf43",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Gets page2 reddit closer to feature parity")),
            ],
        },
        [[
            "bfcb9cb7e3cfa85d23ec0c7bff6fe64a6c0f8183",
            "4f27f5fc752a4ed3dc16e2bf0923a5903c5c6c94",
            "a5fee0220d9d6a457d89f9ab21abd9b1cbec26a6",
            "7a9a64084e5331b0c774e2b78b6e4b38a5ab8e48",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("I can't believe I didn't know about HTMLElement.animate()")),
            ]
        },
        [[
            "06fb4bbb2b0f5f4260a15651b2c3c8cf5012fafd",
        ].join(",")]: {
            bugfixes: [
                rt.ili(rt.txt("Fixes a bug where formatting on Reddit posts is sometimes slightly misaligned. I can't believe I didn't notice this for over 3 years.")),
            ],
        },
        [[
            "e3ed875cdc1ee2168ee3c16eca1ba5955889efd1",
        ].join(",")]: {
            changes: [
                rt.ili(rt.txt("Hide reddit profile images on profiles marked as over18")),
            ],
        },
        [[
            "6d203a302965aeb18f5c8fed0761cd39026eae3c",
        ].join(",")]: {
            changes: [
                rt.ili(rt.txt("Fixes a bug where some gfycat videos refuse to play")),
            ],
        },
        [[
            "4484b296d9fb72a813904727b03ca2e80230a9e7",
        ].join(",")]: {
            changes: [
                rt.ili(
                    rt.txt("On desktop, you can now hover over a post award to see an enlarged version. Example: "),
                    {
                        kind: "emoji",
                        name: "All-Seeing Upvote",
                        url: "https://preview.redd.it/award_images/t5_q0gj4/am40b8b08l581_All-SeeingUpvote2.png?width=16&height=16&auto=webp&s=978c93744e53b8c9305467a7be792e5c401eac6c",
                        hover: {
                            description: "A glowing commendation for all to see",
                            url: "https://www.redditstatic.com/gold/awards/icon/Illuminati_128.png",
                            w: 128,
                            h: 128,
                        },
                    },
                ),
            ],
        },
        [[
            "d26f23f3ba9afe9ead8afdac18a1dca03cdf3d4b",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Fixes a bug where page2 collapse buttons mess with the page scroll")),
            ],
        },
        [[
            "f070202bab45259a1a1206d450a14f81c37f2e0e",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Fixes a bug where page2 flairs don't have a space in front")),
            ],
        },
        [[
            "44edf923a5132a70a64f742e54201ad74cfad654",
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Lazy load profile pictures in page2 rather than loading them all at once")),
            ],
        },
        // 68708a920baf4988ff6d5cb9e8e0a0ee78570724 // I don't have the slightest clue. some info bar fix?
        // 9b0256b462bfd07cd0357e599aa283be81c49206 // some link helper color fix
        // b2704dd83d6fa4c37f5b3aaac411e9d55ce57579 something about codespaces (that was **20 days ago**?!?!? I thought that was recent)
        // 570c7b0a510cfeba742890e0af0dd09f8b71f88b // fixes a bug where it's possible to select items being animated out of view
        [[
            "59567302da47674d0456cbc9d55aa02eefe2712d", // internal improvements to animations
            "666e19957317039b68a42098a9f387b0a71cf368", // ^
            "9e3ee3cdec12aab8acea611176bf47a18562e26a", // code cleanup
            "eb77e71f7e6ef8ea4607efa8380ddf2d1310c6d1", // internal improvements
            "3ae16be1842e546d237ee09f4c25de8d35da990a", // code cleanup
            "03a22a0d769b9fd7f714c9c6e88de0b8e45aa111", // refactor
            "26693d4321ccc267f9b12d5d3d48dd61e1d3b62d", // internal improvements
            "ca07ac07c8da6a802f279f439445beab76b62935", // internal improvements
        ].join(",")]: {
            internal: [
                rt.ili(rt.txt("Clear some technical debt")),
            ],
        },
        ["@@"]: {
            internal: [
                rt.ili(rt.txt("Introduce some more technical debt")),
            ],
        },

        // in command: git log --stat "bd54c07697d47be3c68f14162c37f54ea1fbe752..HEAD"
        // MOST RECENT COMMIT ADDED: b2130e5823ecc062651bfd0f703bdbd5dcfb624a
    },
}));}

export function changelog1() {return autoPost({
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
}));}