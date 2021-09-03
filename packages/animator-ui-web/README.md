# Animator

Animator was a short (1 week) project to create a simple animation program I could use to make this video:

[![TTYLXOX underscores remix animated lyric video](https://user-images.githubusercontent.com/6010774/131990079-02149516-7a0b-48b6-a46e-7802d1b01e1c.png)](https://www.youtube.com/watch?v=PZwjTi79XuE)

Animator is collaborative, so it suppors multiple people editing the same animation at once

A demo is available online at https://animator.pfg.pw/

Animator was created using

- Firebase Realtime Database configured with strict security rules
- Firebase Storage
- Firebase Authentication
- Solid JS, a javascript framework similar to React
- Windi CSS, a utility-first CSS library similar to Tailwind
- Vite, a fast javascript website bundler
- Typescript

While I have finished developing this project, it is not yet complete. Many workarounds were needed while creating
the demo video.

- Switching between tools (pen/eraser) requires editing code and using hot reload to get the changes without
  reloading the page
- The canvas cannot be zoomed or rotated
- Onion skinning only shows one frame behind and one frame ahead
- Frames cannot be copy/pasted
- Complicated frames take a long time to render
- Playback does not account for the time it takes to render and display a frame on screen. This causes audio
  to be slightly desynced.
- Undo/Redo are only available on touch devices (two/three finger tap)
- The frame selector can only be zoomed on mobile
- Large projects take a long time to load
- Frames with many actions take a long time to undo
- The final animation cannot be exported. For my project, I used a screen recorder to capture the result and
  then made some small edits in a video editor.
- In order for multiple people to collaborate on an animation, they must share an account

All of these issues have straightforward solutions if I ever continue developing Animator in the future.
