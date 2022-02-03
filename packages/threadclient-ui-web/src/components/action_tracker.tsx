// - if the task goes on for more than like 200ms,
//   show it visibly in a little notifictation like a
//   loading icon in the bottom right corner you can
//   click to expand and view tasks
// - if it errors, show a full notification of the
//   error

// so eg you upvote something
// - the button disables and the one in the infobar grays out
// - if it takes >1s or something
//   - show a little loader in the bottom right corner
//   - you can click it to expand and show all the things that are being loaded
// - if it errors
//   - expand that thing to show a full notification
// - probably keep unique, consistent symbols for all the actions or something

export function addAction<T>(action: T): T {
    // TODO this function just exists to track callsites for future changes.
    return action;
}