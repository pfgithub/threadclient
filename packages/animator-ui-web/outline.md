# general outline

## feel

the ui does not feel nice right now. this is because of:

- [ ] the frame switcher bar is wayy too finicky

  - [x] you should move your finger over the length of one frame to switch a frame
  - [ ] intertial scrolling is required
  - [ ] you should be able to tap a frame to go to it
  - [ ] here's an idea : what if the current behaviour of the centered item being active is removed and instead
        you can only tap to focus, so if you want to go to some frame you

    - scroll to it
    - tap on it

    the point of this is that then there wouldn't be this weird behaviour where as you scroll the animation is playing
    because it wouldn't seek sound at all. if you want sounds while seeking, you can use that seekbar thing at the
    top ↓

  - [ ] there should be a quick scrubber bar at the top you can drag to go anywhere
  - [x] it's hard to see if a frame is real or not. this should be represented better in the ui, like eg the start real
        frame could be displayed as it is now but then spaces between it and the fake frames following it are filled in
        with a different tone of color so it's obvious they're related
  - [ ] would be nice to have a button to jump to the keyframe
  - [ ] the audio waveform/volume thing should be shown somewhere
  - [ ] ideally, the frame switcher bar would be zoomable I think

- [ ] deleting the contents of a frame / deleting the frame.
  - there should be a simple button I can press to create a keyframe
  - there should be a button I can press to delete the contents of a keyframe and then I should be able to press it
    again to delete the keyframe. this is undoable so it doesn't matter
- [ ] redo. you can't redo right now
- [ ] moving a frame. I want to be able to cut/paste a frame if I accidentally put it in the wrong place
- [ ] onion skinning. I feel like I can't see without it. also now that things are drawn with real holes, this shouldn't
      be too difficult to implement but unfortunately without perf improvements it will be bad.
- [ ] wishlist: making a frame add on top of a previous marked frame. so eg if I'm doing text one word at a time I don't
      have to copy/paste and then have issues if I want to eg edit a previous word
  - just adding frame copy/paste or onion skinning is probably good enough for now

from using it a little bit, these are the main things I noticed. other things I know are an issue but didn't
really have that much trouble with:

- [ ] tools. I want to be able to switch between pen/eraser and remove the hack where touch is currently erase always
- [ ] can't zoom. I need zoom and it needs to be good, correct zoom where a line drawn between two fingers is maintained

## dev experience

- [x] I need a better system for accepting input events. some proper gesture system or something. the current thing is
      a mess.
  - check out some libraries eg:
    - https://zingchart.github.io/zingtouch/
    - https://hammerjs.github.io/
  - these will give me more useful events. hopefully they send single touch events immediately and then
    cancel them if they are used as a multitouch event.

## checkpointing

- here's how to do checkpointing:
- [ ] 1: don't delete actions (edit the security rules to disallow this)
  - actions are added forever.
  - undo is just adding an action that says 'invalidate the action with the id x'
  - go right to left when loading and put all the invalidated actions into a set, then
    ignore them. ignore while going right to left too so you can invalidate an invalidate
    action
  - then operate like normal, just ignoring the invalidated actions
- [ ] 2: trusted clients can make checkpoints whenever they feel like. checkpoints are for
      a given point in time.
- [ ] 3: when loading, first fetch the most recent checkpoint, then only fetch actions after that
      checkpoint. note that in rare occasions, an invalidate action will refer to an action before
      the checkpoint (invalidate actions should probably contain both id and server_time, server_time
      so it's easy to check if the action it's referring to is before the checkpoint you have loaded)
  - in this case: go fetch a checkpoint before the action that you need to go back to and all the
    actions past that point, then resimulate from that point. this resimulation hopefully won't be
    all that expensive because it's likely only resimulating a single frame, the most expensive
    part of that is the load.

## rendering perf

- [x] switch cachedstate to use signals per frame rather than a store. I haven't done any testing, but I'm guessing the
      proxied getters/setters are causing some performance issues.
- [x] although I'm not sure because current drawings are in a store that uses a map and those have bad perf too, so it
      might just be rendering (this was because current drawings render on the same canvas as thumbnails, which were
      having bad performance)
- [ ] if necessary, they can probably be rendered in webgl with zig. ideally, lots of intensive stuff could be moved
      over to wasm and also performed off-thread when possible

## loading perf

- [ ] do checkpointing. save checkpoints
- [ ] load audio and state in parallel

## collaborative usage

- [ ] each connection should have its own id with its own undo list
- [ ] connections should have presence so you can see if any other clients are online
- [ ] it should be possible to share an animation with another account as either view-only or editable
- [ ] it should be possible to share an animation by just a link with a token in it as either view-only or
      editable
- [ ] maybe don't do view-only for now as that could introduce issues

## offline usage

- [ ] set up VitePWA

## navigation

- [ ] use a proper app router
- [ ] make the app an SPA

## security

- [ ] set up recaptcha v3 and use social sign on or something

## login

- [ ] support social sign on
- [ ] support unauthenticated usage where stuff just isn't saved to the cloud, and allow creating an account and
      uploading all the stuff to the account
