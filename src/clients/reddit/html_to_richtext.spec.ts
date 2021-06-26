import { getRedditMarkdownRenderer } from "../../app";
import type { TestState } from "../../tests/root_solid";
import type * as Generic from "../../types/generic";
import {rt} from "../../types/generic";

// I should just use a normal testing framework so I can get coverage and stuff
// need to find one that runs in the browser / in node w/ browser functions
export async function testHtmlToRichtext(update: (tests: TestState[]) => void): Promise<void> {
    const state: TestState[] = reddit_html_tests.map((test, i) => ({title: "#"+(i+1), mode: "none", text: []}));
    update([...state]);
    const [mdr, htr] = await Promise.all([
        getRedditMarkdownRenderer(),
        import("./html_to_richtext"),
    ]);
    for(const [i, test] of reddit_html_tests.entries()) {
        let error = false;
        const text: string[] = [];
        if(test[0] != null) {
            const md_as_html = mdr.renderMd(test[0]);
            if(md_as_html !== test[1]) {
                error = true;
                text.push("MD → HTML Errored. MD:");
                text.push(test[0]);
                text.push("Expected HTML:");
                text.push(test[1]);
                text.push("Got HTML:");
                text.push(md_as_html);
            }else{
                text.push("✓ MD → HTML Ok.");
            }
        }
        const html_as_rt = JSON.stringify(htr.parseContentHTML(test[1]));
        const expected_rt = JSON.stringify(test[2]);
        if(html_as_rt !== expected_rt) {
            error = true;
            text.push("HTML → RT Errored. HTML:");
            text.push(test[1]);
            text.push("Expected RT:");
            text.push(expected_rt);
            text.push("Got RT:");
            text.push(html_as_rt);
        }else{
            text.push("✓ HTML → RT Ok.");
        }

        state[i] = {...state[i]!, mode: error ? "error" : "done", text};
        update([...state]);
        await new Promise(r => setTimeout(r, 0));
    }
}

// this test set doesn't include basic things like **bold**, ***bold italic***, <ul>, <ol>, …
// I should probably go find the other test set that has those
export const reddit_html_tests: [markdown: string | null, html: string, richtext: Generic.Richtext.Paragraph[]][] = [
    ["", "", []],
    [" ", "", []],
    ["http://www.reddit.com", "<p><a href=\"http://www.reddit.com\">http://www.reddit.com</a></p>\n", [
        rt.p(rt.link("http://www.reddit.com", {}, rt.txt("http://www.reddit.com"))),
    ]],
    ["http://www.reddit.com/a\x00b", "<p><a href=\"http://www.reddit.com/ab\">http://www.reddit.com/ab</a></p>\n", [
        rt.p(rt.link("http://www.reddit.com/ab", {}, rt.txt("http://www.reddit.com/ab"))),
    ]],
    ["foo@example.com", "<p><a href=\"mailto:foo@example.com\">foo@example.com</a></p>\n", [
        rt.p(rt.link("mailto:foo@example.com", {}, rt.txt("foo@example.com"))),
    ]],
    ["[foo](http://en.wikipedia.org/wiki/Link_(film\\))", "<p><a href=\"http://en.wikipedia.org/wiki/Link_(film)\">foo</a></p>\n", [
        rt.p(rt.link("http://en.wikipedia.org/wiki/Link_(film)", {}, rt.txt("foo"))),
    ]],
    ["(http://tsfr.org)", "<p>(<a href=\"http://tsfr.org\">http://tsfr.org</a>)</p>\n", [
        rt.p(rt.txt("("), rt.link("http://tsfr.org", {}, rt.txt("http://tsfr.org")), rt.txt(")")),
    ]],
    ["[A link with a /r/subreddit in it](/lol)", "<p><a href=\"/lol\">A link with a /r/subreddit in it</a></p>\n", [
        rt.p(rt.link("https://www.reddit.com/lol", {}, rt.txt("A link with a /r/subreddit in it"))),
    ]],
    ["[A link with a http://www.url.com in it](/lol)", "<p><a href=\"/lol\">A link with a http://www.url.com in it</a></p>\n", [
        rt.p(rt.link("https://www.reddit.com/lol", {}, rt.txt("A link with a http://www.url.com in it"))),
    ]],
    ["[Empty Link]()", "<p>[Empty Link]()</p>\n", [
        rt.p(rt.txt("[Empty Link]()")),
    ]],
    ["http://en.wikipedia.org/wiki/café_racer", "<p><a href=\"http://en.wikipedia.org/wiki/caf%C3%A9_racer\">http://en.wikipedia.org/wiki/café_racer</a></p>\n", [
        rt.p(rt.link("http://en.wikipedia.org/wiki/caf%C3%A9_racer", {}, rt.txt("http://en.wikipedia.org/wiki/café_racer"))),
    ]],
    ["#####################################################hi", "<h6>###############################################hi</h6>\n", [
        rt.hn(6, rt.txt("###############################################hi")),
    ]],
    // ["[foo](http://bar\nbar)", "<p><a href=\"http://bar%0Abar\">foo</a></p>\n", [
        
    // ]],
    ["/r/test", "<p><a href=\"/r/test\">/r/test</a></p>\n", [
        rt.p(rt.link("https://www.reddit.com/r/test", {}, rt.txt("/r/test"))),
    ]],
    ["Words words /r/test words", "<p>Words words <a href=\"/r/test\">/r/test</a> words</p>\n", [
        rt.p(rt.txt("Words words "), rt.link("https://www.reddit.com/r/test", {}, rt.txt("/r/test")), rt.txt(" words")),
    ]],
    // ["/r/", "<p>/r/</p>\n", [
        
    // ]],
    // ["escaped \\/r/test", "<p>escaped /r/test</p>\n", [
        
    // ]],
    // ["ampersands http://www.google.com?test&blah", "<p>ampersands <a href=\"http://www.google.com?test&amp;blah\">http://www.google.com?test&amp;blah</a></p>\n", [
        
    // ]],
    ["[_regular_ link with nesting](/test)", "<p><a href=\"/test\"><em>regular</em> link with nesting</a></p>\n", [
        rt.p(rt.link("https://www.reddit.com/test", {}, rt.txt("regular", {emphasis: true}), rt.txt(" link with nesting"))),
    ]],
    // [" www.a.co?with&test", "<p><a href=\"http://www.a.co?with&amp;test\">www.a.co?with&amp;test</a></p>\n", [
        
    // ]],
    ["Normal^superscript", "<p>Normal<sup>superscript</sup></p>\n", [
        rt.p(rt.txt("Normal"), rt.txt("superscript", {superscript: true})),
    ]],
    // ["Escape\\^superscript", "<p>Escape^superscript</p>\n", [
        
    // ]],
    // ["^(Multiple words superscript)", "<p><sup>Multiple words superscript</sup></p>\n", [
        
    // ]],
    ["~~normal strikethrough~~", "<p><del>normal strikethrough</del></p>\n", [
        rt.p(rt.txt("normal strikethrough", {strikethrough: true})),
    ]],
    // ["\\~~escaped strikethrough~~", "<p>~~escaped strikethrough~~</p>\n", [
        
    // ]],
    // ["anywhere\x03, you", "<p>anywhere, you</p>\n", [
        
    // ]],
    // ["[Test](//test)", "<p><a href=\"//test\">Test</a></p>\n", [
        
    // ]],
    // ["[Test](//#test)", "<p><a href=\"//#test\">Test</a></p>\n", [
        
    // ]],
    // ["[Test](#test)", "<p><a href=\"#test\">Test</a></p>\n", [
        
    // ]],
    // ["[Test](git://github.com)", "<p><a href=\"git://github.com\">Test</a></p>\n", [
        
    // ]],
    // ["[Speculation](//?)", "<p><a href=\"//?\">Speculation</a></p>\n", [
        
    // ]],
    // ["/r/sr_with_underscores", "<p><a href=\"/r/sr_with_underscores\">/r/sr_with_underscores</a></p>\n", [
        
    // ]],
    // ["[Test](///#test)", "<p><a href=\"///#test\">Test</a></p>\n", [
        
    // ]],
    // ["/r/multireddit+test+yay", "<p><a href=\"/r/multireddit+test+yay\">/r/multireddit+test+yay</a></p>\n", [
        
    // ]],
    // ["<test>", "<p>&lt;test&gt;</p>\n", [
        
    // ]],
    // ["words_with_underscores", "<p>words_with_underscores</p>\n", [
        
    // ]],
    ["words*with*asterisks", "<p>words<em>with</em>asterisks</p>\n", [
        rt.p(rt.txt("words"), rt.txt("with", {emphasis: true}), rt.txt("asterisks")),
    ]],
    // ["~test", "<p>~test</p>\n", [
        
    // ]],
    // ["/u/test", "<p><a href=\"/u/test\">/u/test</a></p>\n", [
        
    // ]],
    // ["/u/test/m/test test", "<p><a href=\"/u/test/m/test\">/u/test/m/test</a> test</p>\n", [
        
    // ]],
    // ["/U/nope", "<p>/U/nope</p>\n", [
        
    // ]],
    // ["/r/test/m/test test", "<p><a href=\"/r/test/m/test\">/r/test/m/test</a> test</p>\n", [
        
    // ]],
    // ["/r/test/w/test test", "<p><a href=\"/r/test/w/test\">/r/test/w/test</a> test</p>\n", [
        
    // ]],
    // ["/r/test/comments/test test", "<p><a href=\"/r/test/comments/test\">/r/test/comments/test</a> test</p>\n", [
        
    // ]],
    // ["/u/test/commentscommentscommentscommentscommentscommentscomments/test test", "<p><a href=\"/u/test/commentscommentscommentscommentscommentscommentscomments/test\">/u/test/commentscommentscommentscommentscommentscommentscomments/test</a> test</p>\n", [
        
    // ]],
    // ["a /u/reddit", "<p>a <a href=\"/u/reddit\">/u/reddit</a></p>\n", [
        
    // ]],
    // ["u/reddit", "<p><a href=\"/u/reddit\">u/reddit</a></p>\n", [
        
    // ]],
    // ["a u/reddit", "<p>a <a href=\"/u/reddit\">u/reddit</a></p>\n", [
        
    // ]],
    // ["a u/reddit/foobaz", "<p>a <a href=\"/u/reddit/foobaz\">u/reddit/foobaz</a></p>\n", [
        
    // ]],
    // ["foo:u/reddit", "<p>foo:<a href=\"/u/reddit\">u/reddit</a></p>\n", [
        
    // ]],
    // ["fuu/reddit", "<p>fuu/reddit</p>\n", [
        
    // ]],
    // ["a\u{3002}u/reddit", "<p>a\u{3002}u/reddit</p>\n", [
        
    // ]],
    // ["\\/u/me", "<p>/u/me</p>\n", [
        
    // ]],
    // ["\\\\/u/me", "<p>\\<a href=\"/u/me\">/u/me</a></p>\n", [
        
    // ]],
    // ["\\u/me", "<p>\\<a href=\"/u/me\">u/me</a></p>\n", [
        
    // ]],
    // ["\\\\u/me", "<p>\\<a href=\"/u/me\">u/me</a></p>\n", [
        
    // ]],
    // ["u\\/me", "<p>u/me</p>\n", [
        
    // ]],
    ["*u/me*", "<p><em><a href=\"/u/me\">u/me</a></em></p>\n", [
        rt.p(rt.link("https://www.reddit.com/u/me", {}, rt.txt("u/me", {emphasis: true}))),
    ]],
    // ["foo^u/me", "<p>foo<sup><a href=\"/u/me\">u/me</a></sup></p>\n", [
        
    // ]],
    // ["*foo*u/me", "<p><em>foo</em><a href=\"/u/me\">u/me</a></p>\n", [
        
    // ]],
    // ["u/me", "<p><a href=\"/u/me\">u/me</a></p>\n", [
        
    // ]],
    // ["/u/me", "<p><a href=\"/u/me\">/u/me</a></p>\n", [
        
    // ]],
    // ["u/m", "<p>u/m</p>\n", [
        
    // ]],
    // ["/u/m", "<p>/u/m</p>\n", [
        
    // ]],
    // ["/f/oobar", "<p>/f/oobar</p>\n", [
        
    // ]],
    // ["f/oobar", "<p>f/oobar</p>\n", [
        
    // ]],
    // ["/r/test/commentscommentscommentscommentscommentscommentscomments/test test", "<p><a href=\"/r/test/commentscommentscommentscommentscommentscommentscomments/test\">/r/test/commentscommentscommentscommentscommentscommentscomments/test</a> test</p>\n", [
        
    // ]],
    // ["blah \\", "<p>blah \\</p>\n", [
        
    // ]],
    // ["/r/whatever: fork", "<p><a href=\"/r/whatever\">/r/whatever</a>: fork</p>\n", [
        
    // ]],
    // ["/r/t:timereddit", "<p><a href=\"/r/t:timereddit\">/r/t:timereddit</a></p>\n", [
        
    // ]],
    // ["/r/reddit.com", "<p><a href=\"/r/reddit.com\">/r/reddit.com</a></p>\n", [
        
    // ]],
    // ["/r/not.cool", "<p><a href=\"/r/not\">/r/not</a>.cool</p>\n", [
        
    // ]],
    // ["/r/very+clever+multireddit+reddit.com+t:fork+yay", "<p><a href=\"/r/very+clever+multireddit+reddit.com+t:fork+yay\">/r/very+clever+multireddit+reddit.com+t:fork+yay</a></p>\n", [
        
    // ]],
    // ["/r/t:heatdeathoftheuniverse", "<p><a href=\"/r/t:heatdeathoftheuniverse\">/r/t:heatdeathoftheuniverse</a></p>\n", [
        
    // ]],
    // ["/r/all-minus-something", "<p><a href=\"/r/all-minus-something\">/r/all-minus-something</a></p>\n", [
        
    // ]],
    // ["/r/notall-minus", "<p><a href=\"/r/notall\">/r/notall</a>-minus</p>\n", [
        
    // ]],
    // ["a /r/reddit.com", "<p>a <a href=\"/r/reddit.com\">/r/reddit.com</a></p>\n", [
        
    // ]],
    // ["a r/reddit.com", "<p>a <a href=\"/r/reddit.com\">r/reddit.com</a></p>\n", [
        
    // ]],
    // ["foo:r/reddit.com", "<p>foo:<a href=\"/r/reddit.com\">r/reddit.com</a></p>\n", [
        
    // ]],
    // ["foobar/reddit.com", "<p>foobar/reddit.com</p>\n", [
        
    // ]],
    // ["a\u{3002}r/reddit.com", "<p>a\u{3002}r/reddit.com</p>\n", [
        
    // ]],
    // ["/R/reddit.com", "<p>/R/reddit.com</p>\n", [
        
    // ]],
    // ["/r/irc://foo.bar/", "<p><a href=\"/r/irc\">/r/irc</a>://foo.bar/</p>\n", [
        
    // ]],
    // ["/r/t:irc//foo.bar/", "<p><a href=\"/r/t:irc//foo\">/r/t:irc//foo</a>.bar/</p>\n", [
        
    // ]],
    // ["/r/all-irc://foo.bar/", "<p><a href=\"/r/all-irc\">/r/all-irc</a>://foo.bar/</p>\n", [
        
    // ]],
    // ["/r/foo+irc://foo.bar/", "<p><a href=\"/r/foo+irc\">/r/foo+irc</a>://foo.bar/</p>\n", [
        
    // ]],
    // ["/r/www.example.com", "<p><a href=\"/r/www\">/r/www</a>.example.com</p>\n", [
        
    // ]],
    // [".http://reddit.com", "<p>.<a href=\"http://reddit.com\">http://reddit.com</a></p>\n", [
        
    // ]],
    // ["[r://<http://reddit.com/>](/aa)", "<p><a href=\"/aa\">r://<a href=\"http://reddit.com/\">http://reddit.com/</a></a></p>\n", [
        
    // ]],
    // ["/u/http://www.reddit.com/user/reddit", "<p><a href=\"/u/http\">/u/http</a>://<a href=\"http://www.reddit.com/user/reddit\">www.reddit.com/user/reddit</a></p>\n", [
        
    // ]],
    // ["www.http://example.com/", "<p><a href=\"http://www.http://example.com/\">www.http://example.com/</a></p>\n", [
        
    // ]],
    ["|||||\n-|-|-|-|-|\n|\n", "<table><thead>\n<tr>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n</tr>\n</thead><tbody>\n<tr>\n<td colspan=\"4\" ></td>\n</tr>\n</tbody></table>\n", [
        rt.table(
            [rt.th(undefined), rt.th(undefined), rt.th(undefined), rt.th(undefined)],
            [rt.td()],
        ),
    ]],
    // ["||\n-|-|\n|\n", "<table><thead>\n<tr>\n<th></th>\n</tr>\n</thead><tbody>\n<tr>\n<td></td>\n</tr>\n</tbody></table>\n", [
        
    // ]],
    // ["|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||\n-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|\n|\n", "<table><thead>\n<tr>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n<th></th>\n</tr>\n</thead><tbody>\n<tr>\n<td colspan=\"64\" ></td>\n</tr>\n</tbody></table>\n", [
        
    // ]],
    // ["||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||\n-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|\n|\n", "<p>||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||\n-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|-|\n|</p>\n", [
        
    // ]],
    // ["&thetasym;", "<p>&thetasym;</p>\n", [
        
    // ]],
    // ["&foobar;", "<p>&amp;foobar;</p>\n", [
        
    // ]],
    // ["&nbsp", "<p>&amp;nbsp</p>\n", [
        
    // ]],
    // ["&#foobar;", "<p>&amp;#foobar;</p>\n", [
        
    // ]],
    // ["&#xfoobar;", "<p>&amp;#xfoobar;</p>\n", [
        
    // ]],
    // ["&#9999999999;", "<p>&amp;#9999999999;</p>\n", [
        
    // ]],
    // ["&#99;", "<p>&#99;</p>\n", [
        
    // ]],
    // ["&#x7E;", "<p>&#x7E;</p>\n", [
        
    // ]],
    // ["&#X7E;", "<p>&#x7E;</p>\n", [
        
    // ]],
    // ["&frac12;", "<p>&frac12;</p>\n", [
        
    // ]],
    // ["aaa&frac12;aaa", "<p>aaa&frac12;aaa</p>\n", [
        
    // ]],
    // ["&", "<p>&amp;</p>\n", [
        
    // ]],
    // ["&;", "<p>&amp;;</p>\n", [
        
    // ]],
    // ["&#;", "<p>&amp;#;</p>\n", [
        
    // ]],
    // ["&#x;", "<p>&amp;#x;</p>\n", [
        
    // ]],
    ["> quotey mcquoteface", "<blockquote>\n<p>quotey mcquoteface</p>\n</blockquote>\n", [
        rt.blockquote(rt.p(rt.txt("quotey mcquoteface"))),
    ]],
    // ["> quotey mcquoteface\nnew line of text what happens?", "<blockquote>\n<p>quotey mcquoteface\nnew line of text what happens?</p>\n</blockquote>\n", [
        
    // ]],
    // ["> quotey mcquoteface\n\ntwo new lines then text what happens?", "<blockquote>\n<p>quotey mcquoteface</p>\n</blockquote>\n\n<p>two new lines then text what happens?</p>\n", [
        
    // ]],
    // ["> quotey mcquoteface\n> more quotey", "<blockquote>\n<p>quotey mcquoteface\nmore quotey</p>\n</blockquote>\n", [
        
    // ]],
    // ["> quotey macquoteface\n\n> another quotey", "<blockquote>\n<p>quotey macquoteface</p>\n\n<p>another quotey</p>\n</blockquote>\n", [
        
    // ]],
    [">! spoily mcspoilerface", "<blockquote class=\"md-spoiler-text\">\n<p>spoily mcspoilerface</p>\n</blockquote>\n", [
        rt.blockquote(rt.p(rt.txt("spoily mcspoilerface"))),
    ]],
    // [">! spoily mcspoilerface\nmore spoilage goes here", "<blockquote class=\"md-spoiler-text\">\n<p>spoily mcspoilerface\nmore spoilage goes here</p>\n</blockquote>\n", [
        
    // ]],
    // [">! spoily mcspoilerface > incorrect quote syntax", "<blockquote class=\"md-spoiler-text\">\n<p>spoily mcspoilerface &gt; incorrect quote syntax</p>\n</blockquote>\n", [
        
    // ]],
    // [">! spoily mcspoilerface\n\n", "<blockquote class=\"md-spoiler-text\">\n<p>spoily mcspoilerface</p>\n</blockquote>\n", [
        
    // ]],
    // [">! spoily mcspoilerface\n\nnormal text here", "<blockquote class=\"md-spoiler-text\">\n<p>spoily mcspoilerface</p>\n</blockquote>\n\n<p>normal text here</p>\n", [
        
    // ]],
    // [">! spoily mcspoilerface\n>! blockspoiler continuation", "<blockquote class=\"md-spoiler-text\">\n<p>spoily mcspoilerface\nblockspoiler continuation</p>\n</blockquote>\n", [
        
    // ]],
    // [">! spoily mcspoilerface\n> quotey mcquoteface", "<blockquote class=\"md-spoiler-text\">\n<p>spoily mcspoilerface</p>\n\n<blockquote>\n<p>quotey mcquoteface</p>\n</blockquote>\n</blockquote>\n", [
        
    // ]],
    // [">! spoiler p1\n>!\n>! spoiler p2\n>! spoiler p3", "<blockquote class=\"md-spoiler-text\">\n<p>spoiler p1</p>\n\n<p>spoiler p2\nspoiler p3</p>\n</blockquote>\n", [
        
    // ]],
    // [">>! spoiler p1\n>!\n>! spoiler p2\n>! spoiler p3", "<blockquote>\n<blockquote class=\"md-spoiler-text\">\n<p>spoiler p1</p>\n\n<p>spoiler p2\nspoiler p3</p>\n</blockquote>\n</blockquote>\n", [
        
    // ]],
    // [">>! spoiler p1\n>!\n>! spoiler p2\n\nnew text", "<blockquote>\n<blockquote class=\"md-spoiler-text\">\n<p>spoiler p1</p>\n\n<p>spoiler p2</p>\n</blockquote>\n</blockquote>\n\n<p>new text</p>\n", [
        
    // ]],
    // [">>! spoiler p1\n>!\n>! spoiler p2\n\n>! new blockspoiler", "<blockquote>\n<blockquote class=\"md-spoiler-text\">\n<p>spoiler p1</p>\n\n<p>spoiler p2</p>\n</blockquote>\n</blockquote>\n\n<blockquote class=\"md-spoiler-text\">\n<p>new blockspoiler</p>\n</blockquote>\n", [
        
    // ]],
    // ["! this is not a spoiler", "<p>! this is not a spoiler</p>\n", [
        
    // ]],
    // [">!\nTesting", "<blockquote class=\"md-spoiler-text\">\n<p>Testing</p>\n</blockquote>\n", [
        
    // ]],
    // [">!\n\nTesting", "<blockquote class=\"md-spoiler-text\">\n</blockquote>\n\n<p>Testing</p>\n", [
        
    // ]],
    // [">!", "<blockquote class=\"md-spoiler-text\">\n</blockquote>\n", [
        
    // ]],
    // [">!\n>!", "<blockquote class=\"md-spoiler-text\">\n</blockquote>\n", [
        
    // ]],
    // [">", "<blockquote>\n</blockquote>\n", [
        
    // ]],
    // ["> some quote goes here\n>", "<blockquote>\n<p>some quote goes here</p>\n</blockquote>\n", [
        
    // ]],
    ["This is an >!inline spoiler!< sentence.", "<p>This is an <span class=\"md-spoiler-text\">inline spoiler</span> sentence.</p>\n", [
        rt.p(rt.txt("This is an "), rt.spoiler(rt.txt("inline spoiler")), rt.txt(" sentence.")),
    ]],
    // [">!Inline spoiler!< starting the sentence", "<p><span class=\"md-spoiler-text\">Inline spoiler</span> starting the sentence</p>\n", [
        
    // ]],
    // ["Inline >!spoiler with *emphasis*!< test", "<p>Inline <span class=\"md-spoiler-text\">spoiler with <em>emphasis</em></span> test</p>\n", [
        
    // ]],
    // [">! This is an illegal blockspoiler >!with an inline spoiler!<", "<p>&gt;! This is an illegal blockspoiler <span class=\"md-spoiler-text\">with an inline spoiler</span></p>\n", [
        
    // ]],
    // ["This is an >!inline spoiler with some >!additional!< text!<", "<p>This is an <span class=\"md-spoiler-text\">inline spoiler with some &gt;!additional</span> text!&lt;</p>\n", [
        
    // ]],
    ["```\nhello, world!\n```", "<pre><code>hello, world!\n</code></pre>\n", [
        {kind: "code_block", text: "hello, world!\n"},
    ]],
    ["```javascript\nimport leftpad from \"left-pad\";\n```", "<pre><code class=\"md-code-language-javascript\">import leftpad from &quot;left-pad&quot;;\n</code></pre>\n", [
        {kind: "code_block", lang: "javascript", text: "import leftpad from \"left-pad\";\n"},
    ]],
    // huh. turns out
    // 1. item one
    // 2. item two
    //    - sublist item
    //    - sublist item
    // this is supposed to be a tight list
    // so tight list ≠ only span content
    [`\`\`\`zig
test
line 2
\`\`\`

|test|test2|test3|test4|
|:-|-:|:-:|-|
|one|two|three|four|

**bold**, *italic*, ***strong emphasis***

It works! This is the default webpage for this web server

- list
- item
  - contains another item
- wow

1. one
1. two
1. three

soft${"  "}
break${"  "}
wow!`, `<pre><code class="md-code-language-zig">test
line 2
</code></pre>

<table><thead>
<tr>
<th align="left">test</th>
<th align="right">test2</th>
<th align="center">test3</th>
<th>test4</th>
</tr>
</thead><tbody>
<tr>
<td align="left">one</td>
<td align="right">two</td>
<td align="center">three</td>
<td>four</td>
</tr>
</tbody></table>

<p><strong>bold</strong>, <em>italic</em>, <strong><em>strong emphasis</em></strong></p>

<p>It works! This is the default webpage for this web server</p>

<ul>
<li>list</li>
<li>item

<ul>
<li>contains another item</li>
</ul></li>
<li>wow</li>
</ul>

<ol>
<li>one</li>
<li>two</li>
<li>three</li>
</ol>

<p>soft<br/>
break<br/>
wow!</p>
`, [
        {kind: "code_block", lang: "zig", text: "test\nline 2\n"},
        rt.table(
            [rt.th("left", rt.txt("test")), rt.th("right", rt.txt("test2")), rt.th("center", rt.txt("test3")), rt.th(undefined, rt.txt("test4"))],
            [rt.td(rt.txt("one")), rt.td(rt.txt("two")), rt.td(rt.txt("three")), rt.td(rt.txt("four"))],
        ),
        rt.p(rt.txt("bold", {strong: true}), rt.txt(", "), rt.txt("italic", {emphasis: true}), rt.txt(", "), rt.txt("strong emphasis", {strong: true, emphasis: true})),
        rt.p(rt.txt("It works! This is the default webpage for this web server")),
        rt.ul(
            rt.li(rt.p(rt.txt("list"))),
            rt.li(rt.p(rt.txt("item ")), rt.ul(
                rt.li(rt.p(rt.txt("contains another item")))
            )),
            rt.li(rt.p(rt.txt("wow"))),
        ),
        rt.ol(
            rt.li(rt.p(rt.txt("one"))),
            rt.li(rt.p(rt.txt("two"))),
            rt.li(rt.p(rt.txt("three"))),
        ),
        rt.p(
            // soft breaks aren't quite right - the space shouldn't be kept.
            rt.txt("soft"), rt.br(),
            rt.txt(" break"), rt.br(),
            rt.txt(" wow!")
        ),
    ]],
    [null, `<!-- SC_OFF --><div class="md wiki"><div class="toc"><ul><li class="wiki_the_hfy_wiki"><a href="#wiki_the_hfy_wiki">The HFY Wiki</a></li><li class="toc_child"><ul><li class="wiki_guides"><a href="#wiki_guides">Guides</a></li><li class="wiki_recommended_reading"><a href="#wiki_recommended_reading">Recommended Reading</a></li><li class="toc_child"><ul><li class="wiki_oc"><a href="#wiki_oc">OC</a></li><li class="wiki_outside_authors"><a href="#wiki_outside_authors">Outside Authors</a></li></ul></li><li class="wiki_the_reference_library"><a href="#wiki_the_reference_library">The Reference Library</a></li><li class="wiki_tools_.26amp.3B_development"><a href="#wiki_tools_.26amp.3B_development">Tools &amp; Development</a></li></ul></li></ul></div><h1 id="wiki_the_hfy_wiki">The HFY Wiki</h1>
<p>From here, you will be able to navigate to other sections of the wiki to read stories, our community&#39;s expectations, how to format posts, and much more.<br />
<strong>Authors:</strong> Want your own wiki page? Send a <a href="http://www.reddit.com/message/compose?to=%2Fr%2FHFY" rel="nofollow">message to the mods!</a> </p>
<h2 id="wiki_guides">Guides</h2>
<ul>
<li><a href="/r/hfy/wiki/ref/faq" rel="nofollow">Frequently Asked Questions</a></li>
<li><a href="http://www.reddit.com/r/hfy/wiki/ref/standards_and_expectations" rel="nofollow">Standards and Expectations</a></li>
<li><a href="/r/HFY/wiki/ref/faq/formatting_guide" rel="nofollow">Formatting guide</a><br /></li>
<li><a href="https://www.reddit.com/r/hfy/wiki/ref/guidelines" rel="nofollow">Post guidelines</a></li>
<li><a href="http://www.reddit.com/wiki/submitting" rel="nofollow">Official Reddit Submitting Guide</a></li>
<li><a href="/r/hfy/wiki/ref/wiki_updating" rel="nofollow">Wiki Updating</a></li>
<li><a href="http://www.reddit.com/r/HFY/wiki/ref/faq/irc" rel="nofollow">Discord Guide</a></li>
</ul>
<h2 id="wiki_recommended_reading">Recommended Reading</h2>
<h6 id="wiki_oc">OC</h6>
<ul>
<li><a href="/r/HFY/wiki/ref/classics" rel="nofollow">Classics</a></li>
<li><a href="/r/HFY/wiki/ref/must_read" rel="nofollow">Must Read</a></li>
<li><a href="/r/HFY/wiki/featured" rel="nofollow">Past Features</a></li>
</ul>
<h6 id="wiki_outside_authors">Outside Authors</h6>
<ul>
<li><a href="/r/HFY/wiki/ref/hfylibrary" rel="nofollow">HFY Library</a></li>
<li><a href="/r/HFY/wiki/ref/text" rel="nofollow">Text stories from outside /r/HFY</a></li>
</ul>
<h2 id="wiki_the_reference_library"><a href="/r/hfy/wiki/ref" rel="nofollow">The Reference Library</a></h2>
<p>Trying to find a story? Looking for author resources to help with your writing? Check out the reference library.</p>
<ul>
<li><a href="/r/HFY/wiki/ref/tropes" rel="nofollow">Common Tropes/Themes</a></li>
<li><a href="/r/HFY/wiki/ref/universes" rel="nofollow">Popular Universes</a></li>
<li><a href="/r/HFY/wiki/contests" rel="nofollow">Contests</a></li>
<li><a href="/r/HFY/wiki/ref/prompts" rel="nofollow">Writing Prompt Index</a></li>
<li><a href="/r/HFY/wiki/ref/lfs" rel="nofollow">Looking For Story Index</a></li>
<li><a href="/r/HFY/wiki/ref/audio" rel="nofollow">Audio Recordings and Narrations</a></li>
<li><a href="http://www.reddit.com/r/HFY/wiki/authors" rel="nofollow">List of Authors</a></li>
<li><a href="http://www.reddit.com/r/HFY/wiki/series" rel="nofollow">List of Series</a></li>
<li><a href="/r/hfy/wiki/tags/" rel="nofollow">List of OC By Tag</a> <em>No longer up to date</em></li>
</ul>
<h2 id="wiki_tools_.26amp.3B_development"><a href="http://www.reddit.com/r/HFY/wiki/tools" rel="nofollow">Tools &amp; Development</a></h2>
<ul>
<li><a href="/r/HFY/wiki/tools/hfydata" rel="nofollow">HFYdata</a> Developed by <a href="/u/uNople" rel="nofollow">/u/uNople</a> for collecting !V/!N MWC votes and featured nominations</li>
<li><a href="https://np.reddit.com/r/UpdateMeBot/comments/4wirnm/updatemebot_info/" rel="nofollow">UpdateMeBot</a> Developed by <a href="/u/Watchful1" rel="nofollow">/u/Watchful1</a> for notifying users of new story posts</li>
<li><a href="https://waffle.arkmuse.org/" rel="nofollow">Wᵥ4ffle</a> Developed by <a href="/u/GamingWolfie" rel="nofollow">/u/GamingWolfie</a> for the HFY Discord, also performs OC-linking duties on the sub.</li>
<li><strong>Offline</strong> <del><a href="/r/HFY/wiki/tools/hfybot" rel="nofollow">HFYBotReborn</a> Developed by <a href="/u/kaisermagnus" rel="nofollow">/u/kaisermagnus</a><sup> praise the magnus </sup> for automated OC-linking hotness</del></li>
<li><strong>Offline</strong> <del><a href="/r/HFY/wiki/tools/hfysubs" rel="nofollow">HFYsubs</a> Developed by <a href="/u/TheDarkLordSano" rel="nofollow">/u/TheDarkLordSano</a> for notifying users of new story posts</del></li>
<li><strong>Offline</strong> <del><a href="/r/HFY/wiki/tools/hfy_tag_bot" rel="nofollow">HFY_Tag_Bot</a> Developed by <a href="/u/other-guy" rel="nofollow">/u/other-guy</a> for tagging and sorting OC</del> <a href="/r/hfy/wiki/ref/tagging_info" rel="nofollow"><del>Info</del></a> <a href="/r/HFY/wiki/ref/tagging" rel="nofollow"><del>How to</del></a></li>
</ul>
<hr />
<p><a href="/r/hfy/wiki/pages" rel="nofollow">Back To Full Page List</a></p>
</div><!-- SC_ON -->`, [{ordered:false,kind:"list",children:[{kind:"list_item",children:[{
        kind:"paragraph",children:[{url:"#wiki_the_hfy_wiki",kind:"link",children:[{text:
        "The HFY Wiki",styles:{},kind:"text"}]}]}]},{kind:"list_item",children:[{ordered:false,
        kind:"list",children:[{kind:"list_item",children:[{kind:"paragraph",children:[
            {url:"#wiki_guides",kind:"link",children:[{text:"Guides",styles:{},kind:"text"}]}
        ]}]},{kind:"list_item",children:[{kind:"paragraph",children:[{url:"#wiki_recommended_reading"
            ,kind:"link",children:[{text:"Recommended Reading",styles:{},kind:"text"}]}]}]},{kind:
        "list_item",children:[{ordered:false,kind:"list",children:[{kind:"list_item",children:
        [{kind:"paragraph",children:[{url:"#wiki_oc",kind:"link",children:[{text:"OC",styles:
        {},kind:"text"}]}]}]},{kind:"list_item",children:[{kind:"paragraph",children:[{url:
        "#wiki_outside_authors",kind:"link",children:[{text:"Outside Authors",styles:{},kind:
        "text"}]}]}]}]}]},{kind:"list_item",children:[{kind:"paragraph",children:[{url:
        "#wiki_the_reference_library",kind:"link",children:[{text:"The Reference Library",styles:
        {},kind:"text"}]}]}]},{kind:"list_item",children:[{kind:"paragraph",children:[{url:
        "#wiki_tools_.26amp.3B_development",kind:"link",children:[{text:"Tools & Development",styles:
        {},kind:"text"}]}]}]}]}]}]},{level:1,kind:"heading",children:[{text:"The HFY Wiki",styles:
        {},kind:"text"}]},{kind:"paragraph",children:[{text:
        "From here, you will be able to navigate to other sections of the wiki to read stories, our community's expectations, how to format posts, and much more.",styles:
        {},kind:"text"},{kind:"br"},{text:" ",styles:{},kind:"text"},{text:"Authors:",styles:{strong:
        true},kind:"text"},{text:" Want your own wiki page? Send a ",styles:{},kind:"text"},{url:
        "http://www.reddit.com/message/compose?to=%2Fr%2FHFY",kind:"link",children:[{text:
        "message to the mods!",styles:{},kind:"text"}]},{text:" ",styles:{},kind:"text"}]},{level:
        2,kind:"heading",children:[{text:"Guides",styles:{},kind:"text"}]},{ordered:false,kind:
        "list",children:[{kind:"list_item",children:[{kind:"paragraph",children:[{url:
        "https://www.reddit.com/r/hfy/wiki/ref/faq",kind:"link",children:[{text:
        "Frequently Asked Questions",styles:{},kind:"text"}]}]}]},{kind:"list_item",children:[{kind:
        "paragraph",children:[{url:"http://www.reddit.com/r/hfy/wiki/ref/standards_and_expectations",kind:
        "link",children:[{text:"Standards and Expectations",styles:{},kind:"text"}]}]}]},{kind:
        "list_item",children:[{kind:"paragraph",children:[{url:
        "https://www.reddit.com/r/HFY/wiki/ref/faq/formatting_guide",kind:"link",children:[{text:
        "Formatting guide",styles:{},kind:"text"}]},{kind:"br"}]}]},{kind:"list_item",children:[{kind:
        "paragraph",children:[{url:"https://www.reddit.com/r/hfy/wiki/ref/guidelines",kind:
        "link",children:[{text:"Post guidelines",styles:{},kind:"text"}]}]}]},{kind:"list_item",children:
        [{kind:"paragraph",children:[{url:"http://www.reddit.com/wiki/submitting",kind:"link",children:
        [{text:"Official Reddit Submitting Guide",styles:{},kind:"text"}]}]}]},{kind:"list_item",children:
        [{kind:"paragraph",children:[{url:"https://www.reddit.com/r/hfy/wiki/ref/wiki_updating",kind:
        "link",children:[{text:"Wiki Updating",styles:{},kind:"text"}]}]}]},{kind:"list_item",children:[{kind:
        "paragraph",children:[{url:"http://www.reddit.com/r/HFY/wiki/ref/faq/irc",kind:"link",children:[{text:
        "Discord Guide",styles:{},kind:"text"}]}]}]}]},{level:2,kind:"heading",children:[{text:
        "Recommended Reading",styles:{},kind:"text"}]},{level:6,kind:"heading",children:[{text:"OC",styles:
        {},kind:"text"}]},{ordered:false,kind:"list",children:[{kind:"list_item",children:[{kind:
        "paragraph",children:[{url:"https://www.reddit.com/r/HFY/wiki/ref/classics",kind:"link",children:
        [{text:"Classics",styles:{},kind:"text"}]}]}]},{kind:"list_item",children:[{kind:"paragraph",children:
        [{url:"https://www.reddit.com/r/HFY/wiki/ref/must_read",kind:"link",children:[{text:"Must Read",styles:
        {},kind:"text"}]}]}]},{kind:"list_item",children:[{kind:"paragraph",children:[{url:
        "https://www.reddit.com/r/HFY/wiki/featured",kind:"link",children:[{text:"Past Features",styles:{},kind:
        "text"}]}]}]}]},{level:6,kind:"heading",children:[{text:"Outside Authors",styles:{},kind:
        "text"}]},{ordered:false,kind:"list",children:[{kind:"list_item",children:[{kind:"paragraph",children:
        [{url:"https://www.reddit.com/r/HFY/wiki/ref/hfylibrary",kind:"link",children:[{text:"HFY Library",styles:
        {},kind:"text"}]}]}]},{kind:"list_item",children:[{kind:"paragraph",children:[{url:
        "https://www.reddit.com/r/HFY/wiki/ref/text",kind:"link",children:[{text:
        "Text stories from outside /r/HFY",styles:{},kind:"text"}]}]}]}]},{level:2,kind:"heading",children:
        [{url:"https://www.reddit.com/r/hfy/wiki/ref",kind:"link",children:[{text:"The Reference Library",styles:
        {},kind:"text"}]}]},{kind:"paragraph",children:[{text:
        "Trying to find a story? Looking for author resources to help with your writing? Check out the reference library.",styles:
        {},kind:"text"}]},{ordered:false,kind:"list",children:[{kind:"list_item",children:[{kind:"paragraph",children:
        [{url:"https://www.reddit.com/r/HFY/wiki/ref/tropes",kind:"link",children:[{text:
        "Common Tropes/Themes",styles:{},kind:"text"}]}]}]},{kind:"list_item",children:[{kind:"paragraph",children:
        [{url:"https://www.reddit.com/r/HFY/wiki/ref/universes",kind:"link",children:[{text:"Popular Universes",styles:
        {},kind:"text"}]}]}]},{kind:"list_item",children:[{kind:"paragraph",children:[{url:
        "https://www.reddit.com/r/HFY/wiki/contests",kind:"link",children:[{text:"Contests",styles:{},kind:
        "text"}]}]}]},{kind:"list_item",children:[{kind:"paragraph",children:[{url:
        "https://www.reddit.com/r/HFY/wiki/ref/prompts",kind:"link",children:[{text:"Writing Prompt Index",styles:
        {},kind:"text"}]}]}]},{kind:"list_item",children:[{kind:"paragraph",children:[{url:
        "https://www.reddit.com/r/HFY/wiki/ref/lfs",kind:"link",children:[{text:"Looking For Story Index",styles:
        {},kind:"text"}]}]}]},{kind:"list_item",children:[{kind:"paragraph",children:[{url:
        "https://www.reddit.com/r/HFY/wiki/ref/audio",kind:"link",children:[{text:
        "Audio Recordings and Narrations",styles:{},kind:"text"}]}]}]},{kind:"list_item",children:[{kind:
        "paragraph",children:[{url:"http://www.reddit.com/r/HFY/wiki/authors",kind:"link",children:[{text:
        "List of Authors",styles:{},kind:"text"}]}]}]},{kind:"list_item",children:[{kind:"paragraph",children:
        [{url:"http://www.reddit.com/r/HFY/wiki/series",kind:"link",children:[{text:"List of Series",styles:{},kind:
        "text"}]}]}]},{kind:"list_item",children:[{kind:"paragraph",children:[{url:
        "https://www.reddit.com/r/hfy/wiki/tags/",kind:"link",children:[{text:"List of OC By Tag",styles:{},kind:
        "text"}]},{text:" ",styles:{},kind:"text"},{text:"No longer up to date",styles:{emphasis:true},kind:
        "text"}]}]}]},{level:2,kind:"heading",children:[{url:"http://www.reddit.com/r/HFY/wiki/tools",kind:
        "link",children:[{text:"Tools & Development",styles:{},kind:"text"}]}]},{ordered:false,kind:"list",children:
        [{kind:"list_item",children:[{kind:"paragraph",children:[{url:
        "https://www.reddit.com/r/HFY/wiki/tools/hfydata",kind:"link",children:[{text:"HFYdata",styles:{},kind:
        "text"}]},{text:" Developed by ",styles:{},kind:"text"},{url:"https://www.reddit.com/u/uNople",kind:
        "link",children:[{text:"/u/uNople",styles:{},kind:"text"}]},{text:
        " for collecting !V/!N MWC votes and featured nominations",styles:{},kind:"text"}]}]},{kind:
        "list_item",children:[{kind:"paragraph",children:[{url:
        "https://np.reddit.com/r/UpdateMeBot/comments/4wirnm/updatemebot_info/",kind:"link",children:
        [{text:"UpdateMeBot",styles:{},kind:"text"}]},{text:" Developed by ",styles:{},kind:"text"},{url:
        "https://www.reddit.com/u/Watchful1",kind:"link",children:[{text:"/u/Watchful1",styles:{},kind:
        "text"}]},{text:" for notifying users of new story posts",styles:{},kind:"text"}]}]},{kind:
        "list_item",children:[{kind:"paragraph",children:[{url:"https://waffle.arkmuse.org/",kind:
        "link",children:[{text:"Wᵥ4ffle",styles:{},kind:"text"}]},{text:" Developed by ",styles:{},kind:
        "text"},{url:"https://www.reddit.com/u/GamingWolfie",kind:"link",children:[{text:
        "/u/GamingWolfie",styles:{},kind:"text"}]},{text:
        " for the HFY Discord, also performs OC-linking duties on the sub.",styles:{},kind:"text"}]}]},{kind:
        "list_item",children:[{kind:"paragraph",children:[{text:"Offline",styles:{strong:true},kind:"text"},{text:
        " ",styles:{},kind:"text"},{url:"https://www.reddit.com/r/HFY/wiki/tools/hfybot",kind:"link",children:
        [{text:"HFYBotReborn",styles:{strikethrough:true},kind:"text"}]},{text:" Developed by ",styles:
        {strikethrough:true},kind:"text"},{url:"https://www.reddit.com/u/kaisermagnus",kind:"link",children:
        [{text:"/u/kaisermagnus",styles:{strikethrough:true},kind:"text"}]},{text:" praise the magnus ",styles:
        {strikethrough:true,superscript:true},kind:"text"},{text:" for automated OC-linking hotness",styles:
        {strikethrough:true},kind:"text"}]}]},{kind:"list_item",children:[{kind:"paragraph",children:[{text:
        "Offline",styles:{strong:true},kind:"text"},{text:" ",styles:{},kind:"text"},{url:
        "https://www.reddit.com/r/HFY/wiki/tools/hfysubs",kind:"link",children:[{text:"HFYsubs",styles:
        {strikethrough:true},kind:"text"}]},{text:" Developed by ",styles:{strikethrough:true},kind:
        "text"},{url:"https://www.reddit.com/u/TheDarkLordSano",kind:"link",children:[{text:
        "/u/TheDarkLordSano",styles:{strikethrough:true},kind:"text"}]},{text:
        " for notifying users of new story posts",styles:{strikethrough:true},kind:"text"}]}]},{kind:
        "list_item",children:[{kind:"paragraph",children:[{text:"Offline",styles:{strong:true},kind:
        "text"},{text:" ",styles:{},kind:"text"},{url:"https://www.reddit.com/r/HFY/wiki/tools/hfy_tag_bot",kind:
        "link",children:[{text:"HFY_Tag_Bot",styles:{strikethrough:true},kind:"text"}]},{text:" Developed by ",styles:
        {strikethrough:true},kind:"text"},{url:"https://www.reddit.com/u/other-guy",kind:"link",children:[{text:
        "/u/other-guy",styles:{strikethrough:true},kind:"text"}]},{text:" for tagging and sorting OC",styles:
        {strikethrough:true},kind:"text"},{text:" ",styles:{},kind:"text"},{url:
        "https://www.reddit.com/r/hfy/wiki/ref/tagging_info",kind:"link",children:[{text:"Info",styles:{strikethrough:
        true},kind:"text"}]},{text:" ",styles:{},kind:"text"},{url:
        "https://www.reddit.com/r/HFY/wiki/ref/tagging",kind:"link",children:[{text:"How to",styles:{strikethrough:
        true},kind:"text"}]}]}]}]},{kind:"horizontal_line"},{kind:"paragraph",children:[{url:
        "https://www.reddit.com/r/hfy/wiki/pages",kind:"link",children:[{text:"Back To Full Page List",styles:
        {},kind:"text"}]}]}]],
];
