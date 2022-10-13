import {Accessor, createContext, createSignal, JSX, Setter, Signal, untrack, useContext} from "solid-js";
import * as Generic from "api-types-generic";
import { classes } from "../../util/utils_solid";

// click a link to focus it
// - * adds a history breadcrumb

/*
plan:
- file manager view

subreddit
replies:
- post
  content.jpg
  about.md
  upvote.exe
  replies:
  - comment
  - load_more.exe
*/

export default function ExplorerView(props: {
    pivot: Generic.Link<Generic.Post>,
}): JSX.Element {
    // linear-gradient(to bottom right, #15d46f, #4f15d4)
    return <div class="bg-gradient-to-br from-green-400 to-blue-600 h-screen relative">
        <Window>
            <WinTitlebar />
            <div class="p-2">hello</div>
        </Window>
    </div>;
}

function readonlySignal<T>(v: Accessor<T>): Signal<T> {
    return [v, ((nv: T) => {
        if(typeof nv === "function") {
            return nv(untrack(() => v()));
        }
        return nv;
    }) as unknown as Setter<T>]
}

type Winsize = {
    x: number, y: number, w: number, h: number,
};
const winsize_provider = createContext<Signal<Winsize>>(readonlySignal(
    () => ({x: 0, y: 0, w: window.innerWidth, h: window.innerHeight}),
));

function WinTitlebar(): JSX.Element {
    const [winsize, setWinsize] = useContext(winsize_provider);
    return <div class="bg-slate-200 dark:bg-zinc-900 rounded-md p-1" onmousedown={start_ev => {
        draglistener(start_ev, (e, mode) => {
            setWinsize(prev_size => {
                const new_size = {...prev_size};
                new_size.x += e.movementX;
                new_size.y += e.movementY;
                return new_size;
            });
        })
    }}>
        titlebar
    </div>;
}

function Window(props: {
    children: JSX.Element,
}): JSX.Element {
    const [winsize, setWinsize] = createSignal({
        x: 50,
        y: 50,
        w: 200,
        h: 200,
    });
    return <winsize_provider.Provider value={[winsize, setWinsize]}><div class="bg-slate-50 text-slate-900 dark:bg-zinc-800 dark:text-zinc-50 rounded-md shadow" style={{
        'position': "absolute",
        'left': winsize().x + "px",
        'top': winsize().y + "px",
        'width': winsize().w + "px",
        'height': winsize().h + "px",
    }}>
        {([
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], /*,*/ [0, 1],
            [1, -1], [1, 0], [1, 1],
        ] as const).map(dir => {
            const dirj = dir.join(",");
            return <div class={classes(
                "absolute",
                dir[0] < 0 ? "-left-2 w-2" : dir[0] > 0 ? "-right-2 w-2" : "left-0 right-0 w-full",
                dir[1] < 0 ? "-top-2 h-2" : dir[1] > 0 ? "-bottom-2 h-2" : "top-0 bottom-0 h-full",
                dirj === "-1,-1" || dirj === "1,1" ? "cursor-nwse-resize" :
                dirj === "-1,1" || dirj === "1,-1" ? "cursor-nesw-resize" :
                dirj === "-1,0" || dirj === "1,0" ? "cursor-ew-resize" :
                dirj === "0,-1" || dirj === "0,1" ? "cursor-ns-resize" : "E-never",
            )} onmousedown={(start_ev) => draglistener(start_ev, (e, mode) => {
                setWinsize(prev_size => {
                    const new_size = {...prev_size};
                    let [x1, y1] = [prev_size.x, prev_size.y];
                    let [x2, y2] = [prev_size.x + prev_size.w, prev_size.y + prev_size.h];
                    if(dir[0] < 0) x1 += e.movementX;
                    if(dir[0] > 0) x2 += e.movementX;
                    if(dir[1] < 0) y1 += e.movementY;
                    if(dir[1] > 0) y2 += e.movementY;
                    return {x: x1, y: y1, w: x2 - x1, h: y2 - y1};
                });
            })} />;
        })}
        {props.children}
    </div></winsize_provider.Provider>;
}

function draglistener(e: MouseEvent, cb: (e: MouseEvent, mode: "start" | "move" | "end") => void) {
    const handlemousemove = (e: MouseEvent) => {
        cb(e, "move");
    };
    document.addEventListener("mousemove", handlemousemove, {capture: true});
    document.addEventListener("mouseup", e => {
        document.removeEventListener("mousemove", handlemousemove, {capture: true});
        cb(e, "end");
    }, {once: true, capture: true});
    cb(e, "start");
}

// https://github.com/ianpreston/redditfs
// someone did this nine years ago, fun. that's probably why I thought of it.
type Fd = {
    icon: string, // url. used for thumbnails.
    name: string,
    content: FdContent, // fd[] for folders, uint8array for files
    updated_time: number, // put the create/edit time here
    // linux doesn't have a created time, so put it in the info.md
};
type FolderContent = {
    kind: "list",
    fds: Fd[],
} | {
    kind: "symlink",
    to: string,
};
type FdContent = {
    kind: "folder",
    items: FolderContent,
} | {
    kind: "file",
    content: FileContent,
};
type FileContent = {
    type: "data",
    data: Uint8Array, // we'll use markdown for richtext. we'll need something to convert a markdown
    // ast to a markdown file. we're going reddit_markdown→reddit_html→richtext→commonmark.
    // you'll probably want a terminal markdown reader to view this.
} | {
    type: "image",
    url: string, // for web. on native, we'll download the image on read and return it as a Uint8Array
};

/*
organization plan:

/objects/[client]-[item_id]
/url/[url] :
- if it's a loader, it will have 'load.sh'
- otherwise, it will symlink to '/objects/[object_id]'
- note: we might make stuff live at /url/[url] and only use /objects/[objectid] when necessary.
  /objects/[objectid] would symlink to /url/[url] for most objects.
hm. '/url/[url]' is weird

oh it would be nice if we could 'cd ..' to go to the parent, but it looks like it will be 'cd parent'
unless fuse can override '..'
oh or we can just make things into chains

'/objects/@client_root'
'/objects/@sub'
'/objects/@post'
'/objects/@comment' : symlink to '/objects/@client_root/.@sub/.@post/.@comment'

possibly every object could have every other object in it - we choose the symlink target by looping
the parents. if there is a vertical loader, 'cd ..' would put you in the loader and you can do './load'

they wouldn't show up on 'ls', only if you know the name or something

this is very confusing maybe we just use 'parent' links for now

sample:
$> mkdir threadclient && start-tc-fs threadclient && cd threadclient
$> ls
objects/
load_url.sh
$> ls objects : [empty]
$> ./load_url "/reddit/r/all"
✓ Success. 'cd pivot/'
$> ls
objects/
[symlink] pivot/
$> ls

*/

// plan:
// threadclient for
// https://www.npmjs.com/package/node-fuse-bindings
// and demo it in web using a tree-view file manager

// note: rather than treating it as a networked filesystem,
// do all in-memory and have scripts like 'loadmore-[id].sh' to load more content
// for the filesystem.

// also, it should be read-only. maybe an exception of if you
// say to reply to something it could give you a folder to put your stuff in.